import { useCallback } from "react";
import { CountryDetails, Estate } from "../../types/models";
import { useEu4Worker } from "../../worker";
import React from "react";
import { formatInt } from "@/lib/format";

const CountryEstate = ({ estate }: { estate: Estate }) => {
  return (
    <div className="flex w-96 flex-col gap-2 rounded-lg border border-solid border-gray-400/50 p-4 shadow-md drop-shadow-lg">
      <div className="flex">
        <h3 className="inline-block grow">{estate.kind}</h3>
        <span className="flex gap-4">
          <span>Loyalty: {formatInt(estate.loyalty)}%</span>
          <span>Territory: {formatInt(estate.territory)}%</span>
        </span>
      </div>
      <div>Completed agendas: {formatInt(estate.completedAgendas)}</div>
      <div>
        Privileges:
        <table className="ml-4 border-separate border-spacing-x-2">
          {estate.privileges.map(([privilege, date]) => (
            <tr key={privilege}>
              <td>{privilege}</td>
              <td className="no-break">{date}</td>
            </tr>
          ))}
        </table>
        <ul></ul>
        <div>
          Influence modifiers:
          <table className="ml-4 border-separate border-spacing-x-2">
            {estate.influenceModifiers.map((modifier) => (
              <tr key={`${modifier.desc}-${modifier.date}`}>
                <td className="mr-2 text-right">{modifier.value}</td>
                <td className="no-break">{modifier.date}</td>
                <td>{modifier.desc}</td>
              </tr>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
};

const CountryEstateDetails = ({ data }: { data: Estate[] }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="w-96 text-center">
        Crownland:{" "}
        {formatInt(
          data.map((x) => x.territory).reduce((acc, x) => acc - x, 100)
        )}
        %
      </div>
      <div className="flex flex-wrap gap-8">
        {data.map((x) => (
          <CountryEstate key={x.kind} estate={x} />
        ))}
      </div>
    </div>
  );
};

const CountryEstatesImpl = React.memo(CountryEstateDetails);

export interface CountryEstatesProps {
  details: CountryDetails;
}

export const CountryEstates = ({ details }: CountryEstatesProps) => {
  const { data = [] } = useEu4Worker(
    useCallback(
      (worker) => worker.eu4GetCountryEstates(details.tag),
      [details.tag]
    )
  );

  if (data.length == 0) {
    return <div>No estates</div>;
  } else {
    return <CountryEstatesImpl data={data} />;
  }
};
