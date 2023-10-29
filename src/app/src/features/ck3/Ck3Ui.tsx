import {useCallback, useEffect, useReducer} from "react";
import {logMs} from "@/lib/log";
import {timeit} from "@/lib/timeit";
import Head from "next/head";
import {getCk3Worker} from "./worker";
import {MeltButton} from "@/components/MeltButton";
import {Ck3SaveData} from "./worker/types";
import {Alert, Table, TableProps} from "antd";
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
  id: bigint
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
      <p> {data.firstName} of {data.houseName}</p>
      </>
  )
}
interface DataType {
  key: React.Key;
  id: number;
  firstName: string;
  house: string;
  traits: string[]
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
  const columns = [
    {
      title: "ID",
      dataIndex: 'id',
      key: 'id'
    },
    {
      title: "Name",
      dataIndex: 'firstName',
      key: 'firstName'
    },
    {
      title: "House",
      dataIndex: 'houseName',
      key: 'houseName',
      render: (text) => text == null ? "lowborn" : text
    },
    {
      title: "Traits",
      dataIndex: 'traits',
      key: 'traits',
      elipsis: true,
      filterMode: 'tree',
      filterSearch: true,
      width: '80%',
      filters: [
        {
          "text": "intellect_good_3",
          "value": "intellect_good_3"
        }
      ],
      render: (list) => list.join(" "),
      onFilter: (value: string, record) => record.traits.includes(value),
    },
      Table.EXPAND_COLUMN,
  ];
  const onChange: TableProps<DataType>['onChange'] = (pagination, filters, sorter, extra) => {
    console.log('params', pagination, filters, sorter, extra);
  };
  return (
    <Table dataSource={data} columns={columns} expandable={{
      expandedRowRender: (record) => record.traits.join(" "),
    }} onChange={onChange}></Table>
   )
}

type Ck3PageProps = Ck3SaveFile & { saveData: Ck3SaveData };
const Ck3Page = ({save, saveData}: Ck3PageProps) => {
  return (
      <main className="max-w-max">
        <Head>
          <title>{`${save.file.name.replace(".ck3", "")} - CK3 (${
              saveData.meta.version
          }) - PDX Tools`}</title>
        </Head>
        <div className="">
          <h2>CK3</h2>
          <h3>Player character</h3>
          <CharacterDetails id={saveData.gamestate.playerCharacterId}/>
          <h3>Character Finder</h3>
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
