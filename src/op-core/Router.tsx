import { observer } from "mobx-react";
import { Game } from "op-game/Game";
import { Home } from "op-home/Home";
import { Intro } from "op-intro/Intro";
import { Message } from "op-message/Message";
import { Stats } from "op-stats/Stats";
import { Success } from "op-success/Success";
import { Tutorial } from "op-tutorial/Tutorial";
import React, { FC } from "react";
import { useCoreStores } from "./store";

export const Router: FC = observer(function () {
  const { puzzle, router } = useCoreStores();
  if (router.currentRoute === "home") {
    return <Home />;
  } else if (router.currentRoute === "intro") {
    return <Intro />;
  } else if (router.currentRoute === "game") {
    return <Game />;
  } else if (router.currentRoute === "success") {
    return <Success />;
  } else if (router.currentRoute === "stats") {
    return <Stats />;
  } else if (router.currentRoute === "tutorial") {
    if (puzzle.type === "message") {
      return <Message />;
    } else {
      return <Tutorial key={puzzle.id} />;
    }
  } else {
    throw new Error(`Invalid route: ${router.currentRoute}`);
  }
});
