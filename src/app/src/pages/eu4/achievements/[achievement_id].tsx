import React from "react";
import { useRouter } from "next/router";
import { HtmlHead } from "@/components/head";
import { Root, WebPage } from "@/components/layout";
import { AchievementPage } from "@/features/eu4/AchievementPage";
import { Achievement } from "@/services/appApi";
import { GetStaticProps } from "next";
import { getAchievement, loadAchievements } from "@/server-lib/pool";

interface StaticAchievement {
  achievement?: Achievement;
}

export const Eu4Achievement = ({ achievement }: StaticAchievement) => {
  const router = useRouter();
  const { achievement_id } = router.query;
  const prefix = achievement
    ? `${achievement.name} (${achievement.id}) - `
    : "";
  const title = `${prefix}EU4 Achievements - PDX Tools`;
  return (
    <Root>
      <HtmlHead>
        <title>{title}</title>
        <meta
          name="description"
          content={`Leaderboard for EU4 achievement${
            achievement && ` ${achievement.name}: ${achievement.description}`
          }`}
        ></meta>
      </HtmlHead>
      <WebPage>
        {achievement !== undefined ? (
          <AchievementPage
            achievementId={achievement.id.toString()}
            staticAchievement={achievement}
          />
        ) : typeof achievement_id === "string" &&
          !Array.isArray(achievement_id) ? (
          <AchievementPage achievementId={achievement_id} />
        ) : null}
      </WebPage>
    </Root>
  );
};

export default Eu4Achievement;

export async function getStaticPaths() {
  const achievements: Achievement[] = loadAchievements();
  const paths = achievements.map((x) => ({
    params: { achievement_id: x.id.toString() },
  }));
  return { paths, fallback: false };
}

export const getStaticProps: GetStaticProps<StaticAchievement> = async ({
  params,
}) => {
  const achievementId = +(params?.achievement_id ?? "0");
  const achievement: Achievement | undefined = getAchievement(achievementId);

  if (achievement === undefined) {
    throw new Error("achievement needs to be defined");
  }

  return {
    props: {
      achievement,
    },
  };
};
