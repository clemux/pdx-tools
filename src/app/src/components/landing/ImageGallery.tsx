import { useState } from "react";
import Image from "next/image";
import map from "./gallery-map.png";
import mapThumbnail from "./gallery-map-thumbnail.png";
import video from "./gallery-video.mp4";
import videoThumbnail from "./video-thumbnail.png";
import advisor from "./gallery-advisor.png";
import mana from "./gallery-mana.png";
import graphs from "./gallery-graphs.png";
import graphsThumbnail from "./gallery-graphs-thumbnail.png";
import insights from "./gallery-insights.png";
import insightsThumbnail from "./gallery-insights-thumbnail.png";

const images = [
  {
    src: map,
    thumbnail: mapThumbnail,
    alt: "PDX Tools map of a save file",
    title: "Interactive Map",
    description:
      "Pan, zoom, and select provinces, as if EU4 was played within Google Maps",
  },
  {
    src: graphs,
    thumbnail: graphsThumbnail,
    mobile: mana,
    alt: "Visualizations of a save that PDX Tools provides",
    title: "Graphs",
    description:
      "Breakdown a country's mana expense and budget or view the historical ledger",
  },
  {
    src: insights,
    thumbnail: insightsThumbnail,
    mobile: advisor,
    alt: "Screenshot showing map and graph",
    title: "Insights",
    description: "Uncover data not easily exposed in-game",
  },
  {
    src: video,
    alt: "Religion mode timelapse",
    thumbnail: videoThumbnail,
    title: "Timelapses",
    description:
      "Relive your campaign by creating and watching detailed timelapses",
  },
];

const DesktopImageGallery = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = images[selectedIndex];
  return (
    <div className="flex w-full max-w-7xl gap-5">
      <div className="flex basis-[150px] flex-col gap-4">
        {images.map((x, i) => (
          <button
            className="m-0 rounded-xl border-0 bg-transparent p-0"
            key={x.src}
            onClick={() => setSelectedIndex(i)}
          >
            <Image
              src={x.thumbnail}
              aria-selected={i == selectedIndex}
              className="cursor-pointer rounded-xl border-4 border-solid border-slate-400 opacity-80 transition duration-100 ease-in hover:border-teal-700 hover:opacity-100 aria-selected:border-teal-700 aria-selected:opacity-100"
              width={1920}
              height={1080}
              alt={`Select ${x.alt}`}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-grow basis-0 flex-col">
        <div className="mb-3 space-x-4">
          <h2 className="inline">{selected.title}</h2>
          <span>{selected.description}</span>
        </div>
        {selected.src.endsWith("mp4") ? (
          <video
            className="aspect-video w-full drop-shadow-xl"
            src={selected.src}
            autoPlay
            loop
            playsInline
            muted
          />
        ) : (
          <Image
            src={selected.src}
            className="drop-shadow-xl"
            priority={selectedIndex == 0}
            width={1920}
            height={1080}
            alt={selected.alt}
          />
        )}
      </div>
    </div>
  );
};

const MobileImageGallery = () => {
  return (
    <div className="grid gap-28">
      {images.map((x) => {
        return (
          <div key={x.src}>
            <h2>{x.title}</h2>
            <p>{x.description}</p>
            {x.src.endsWith("mp4") ? (
              <video
                className="aspect-video w-full drop-shadow-xl"
                src={x.src}
                autoPlay
                loop
                playsInline
                muted
              />
            ) : (
              <Image
                src={x.mobile ?? x.src}
                className="drop-shadow-xl"
                width={1920}
                height={1080}
                alt={x.alt}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export const ImageGallery = () => {
  return (
    <>
      <div className="hidden lg:block">
        <DesktopImageGallery />
      </div>
      <div className="lg:hidden">
        <MobileImageGallery />
      </div>
    </>
  );
};
