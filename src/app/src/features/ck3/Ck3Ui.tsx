import {useCallback, useEffect, useReducer} from "react";
import {logMs} from "@/lib/log";
import {timeit} from "@/lib/timeit";
import Head from "next/head";
import {getCk3Worker} from "./worker";
import {MeltButton} from "@/components/MeltButton";
import {Ck3SaveData} from "./worker/types";
import {Alert} from "antd";
import {captureException} from "@sentry/nextjs";
import {emitEvent} from "@/lib/plausible";
import {useCk3Worker} from "@/features/ck3/worker/useCk3Worker";

export type Ck3SaveFile = { save: { file: File } };

type Task<T> = {
  fn: () => T | Promise<T>;
  name: string;
};

function runTask<T>({ fn, name }: Task<T>) {
  return timeit(fn).then((res) => {
    logMs(res, name);
    return res.data;
  });
}

async function loadCk3Save(file: File) {
  const worker = getCk3Worker();
  emitEvent({ kind: "parse", game: "ck3" });

  await Promise.all([
    runTask({
      fn: () => worker.initializeWasm(),
      name: "initialized ck3 wasm",
    }),

    runTask({
      fn: () => worker.fetchData(file),
      name: "save data read",
    }),
  ]);

  const { data } = await runTask({
    fn: () => worker.parseCk3(),
    name: "parse ck3 file",
  });

  return { data };
}

type Ck3LoadState = {
  loading: boolean;
  data: Ck3SaveData | null;
  error: unknown | null;
};

type Ck3LoadActions =
  | { kind: "start" }
  | { kind: "data"; data: Ck3SaveData }
  | { kind: "error"; error: unknown };

const loadStateReducer = (
  state: Ck3LoadState,
  action: Ck3LoadActions
): Ck3LoadState => {
  switch (action.kind) {
    case "start": {
      return {
        ...state,
        error: null,
        loading: true,
      };
    }
    case "data": {
      return {
        ...state,
        data: action.data,
        loading: false,
      };
    }
    case "error": {
      return {
        ...state,
        error: action.error,
      };
    }
  }
};

function useLoadCk3(input: Ck3SaveFile) {
  const [{ loading, data, error }, dispatch] = useReducer(loadStateReducer, {
    loading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    dispatch({ kind: "start" });
    loadCk3Save(input.save.file)
      .then(({ data }) => {
        dispatch({ kind: "data", data: data });
      })
      .catch((error) => {
        dispatch({ kind: "error", error });
        captureException(error);
      });
  }, [input]);

  return { loading, data, error };
}



export interface CharacterDetailsProps {
  id: number
}

export const CharacterDetails = ({id}: CharacterDetailsProps) => {
  const { data } = useCk3Worker(
      useCallback(
          (worker) =>
              worker.ck3GetCharacter(BigInt(id)),
          [id]
      )
  )

  // TODO: how to handle null value here?
  return data == null ? null : (
      <>
      <p>Character name: {data.firstName}</p>
      <p>Character house: {data.houseName}</p>
      </>
  )
}

export const CharacterList = () => {
  const {data = []} = useCk3Worker(
      useCallback(
          (worker) => worker.ck3GetCharacters(),
          []
      )
  )
  const characters = data == null ? null : data.slice(0, 10).map(c =>
      <li key={c.id}>{c.firstName} of {c.houseName}</li>
  );
  return (
      <>
       <ul>
         {characters}
       </ul>
       </>
   )
}

type Ck3PageProps = Ck3SaveFile & { saveData: Ck3SaveData };
const Ck3Page = ({save, saveData}: Ck3PageProps) => {
  return (
      <main className="mx-auto mt-4 max-w-screen-lg">
        <Head>
          <title>{`${save.file.name.replace(".ck3", "")} - CK3 (${
              saveData.meta.version
          }) - PDX Tools`}</title>
        </Head>
        <div className="mx-auto max-w-prose">
          <h2>CK3</h2>
          <p>
            Played character: {saveData.gamestate.playedCharacter.character}
          </p>
          <CharacterDetails id={saveData.gamestate.playedCharacter.character}/>
          <CharacterList/>
          {saveData.meta.isMeltable && (
              <MeltButton
                  worker={getCk3Worker()}
                  game="ck3"
                  filename={save.file.name}
              />
          )}
        </div>
      </main>
  );
};

export const Ck3Ui = (props: Ck3SaveFile) => {
  const { data, error } = useLoadCk3(props);
  return (
    <>
      {error && <Alert type="error" closable message={`${error}`} />}
      {data && <Ck3Page {...props} saveData={data} />}
    </>
  );
};

export default Ck3Ui;
