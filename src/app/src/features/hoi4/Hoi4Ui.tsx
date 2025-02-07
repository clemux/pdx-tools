import { useReducer, useEffect } from "react";
import { logMs } from "@/lib/log";
import { timeit } from "@/lib/timeit";
import Head from "next/head";
import { getHoi4Worker } from "./worker";
import { MeltButton } from "@/components/MeltButton";
import { Hoi4Metadata } from "./worker/types";
import { Alert } from "antd";
import { captureException } from "@sentry/nextjs";
import { emitEvent } from "@/lib/plausible";

export type Hoi4SaveFile = { save: { file: File } };
type Hoi4PageProps = Hoi4SaveFile & { meta: Hoi4Metadata };
export const Hoi4Page = ({ save, meta }: Hoi4PageProps) => {
  return (
    <main className="mx-auto mt-4 max-w-screen-lg">
      <Head>
        <title>{`${save.file.name.replace(".hoi4", "")} - Hoi4 (${
          meta.date
        }) - PDX Tools`}</title>
      </Head>
      <div className="mx-auto max-w-prose">
        <h2>Hoi4</h2>
        <p>
          {`An Hoi4 save was detected (date ${meta.date}). At this time, Hoi4 functionality is limited but one can still melt binary saves into plaintext`}
        </p>
        {meta.isMeltable && (
          <MeltButton
            game="hoi4"
            worker={getHoi4Worker()}
            filename={save.file.name}
          />
        )}
      </div>
    </main>
  );
};

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

async function loadHoi4Save(file: File) {
  const worker = getHoi4Worker();
  emitEvent({ kind: "parse", game: "hoi4" });

  await Promise.all([
    runTask({
      fn: () => worker.initializeWasm(),
      name: "initialized Hoi4 wasm",
    }),

    runTask({
      fn: () => worker.fetchData(file),
      name: "save data read",
    }),
  ]);

  const { meta } = await runTask({
    fn: () => worker.parseHoi4(),
    name: "parse Hoi4 file",
  });

  return { meta };
}

type Hoi4LoadState = {
  loading: boolean;
  data: Hoi4Metadata | null;
  error: unknown | null;
};

type Hoi4LoadActions =
  | { kind: "start" }
  | { kind: "data"; data: Hoi4Metadata }
  | { kind: "error"; error: unknown };

const loadStateReducer = (
  state: Hoi4LoadState,
  action: Hoi4LoadActions
): Hoi4LoadState => {
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

function useLoadHoi4(input: Hoi4SaveFile) {
  const [{ loading, data, error }, dispatch] = useReducer(loadStateReducer, {
    loading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    dispatch({ kind: "start" });
    loadHoi4Save(input.save.file)
      .then(({ meta }) => {
        dispatch({ kind: "data", data: meta });
      })
      .catch((error) => {
        dispatch({ kind: "error", error });
        captureException(error);
      });
  }, [input]);

  return { loading, data, error };
}

export const Hoi4Ui = (props: Hoi4SaveFile) => {
  const { data, error } = useLoadHoi4(props);

  return (
    <>
      {error && <Alert type="error" closable message={`${error}`} />}
      {data && <Hoi4Page {...props} meta={data} />}
    </>
  );
};

export default Hoi4Ui;
