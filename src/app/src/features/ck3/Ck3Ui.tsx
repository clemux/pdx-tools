import { useEffect, useReducer } from "react";
import { logMs } from "@/lib/log";
import { timeit } from "@/lib/timeit";
import Head from "next/head";
import { getCk3Worker } from "./worker";
import { MeltButton } from "@/components/MeltButton";
import { Ck3Metadata } from "./worker/types";
import { Alert } from "antd";
import { captureException } from "@sentry/nextjs";
import { emitEvent } from "@/lib/plausible";

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

  const { meta } = await runTask({
    fn: () => worker.parseCk3(),
    name: "parse ck3 file",
  });

  return { meta };
}

type Ck3LoadState = {
  loading: boolean;
  data: Ck3Metadata | null;
  error: unknown | null;
};

type Ck3LoadActions =
  | { kind: "start" }
  | { kind: "data"; data: Ck3Metadata }
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

type Ck3PageProps = Ck3SaveFile & { meta: Ck3Metadata };
const Ck3Page = ({ save, meta }: Ck3PageProps) => {
  return (
    <main className="mx-auto mt-4 max-w-screen-lg">
      <Head>
        <title>{`${save.file.name.replace(".ck3", "")} - CK3 (${
          meta.version
        }) - PDX Tools`}</title>
      </Head>
      <div className="mx-auto max-w-prose">
        <h2>CK3</h2>
        <p>
          {`A CK3 save was detected (version ${meta.version}). At this time, CK3 functionality is limited but one can still melt binary ironman saves into plaintext`}
        </p>
        {meta.isMeltable && (
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
      {data && <Ck3Page {...props} meta={data} />}
    </>
  );
};

export default Ck3Ui;
