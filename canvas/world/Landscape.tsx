"use client";

/**
 * The landscape: limestone bastion and terrace walls with stairs, the garage
 * portal, trees (foam → foliage), pools, planting, the botanical playground
 * and night path lights. Everything in the village is clipped by the section.
 */
import { PathLights } from "./landscape/PathLights";
import { Planting } from "./landscape/Planting";
import { Playground } from "./landscape/Playground";
import { Pools } from "./landscape/Pools";
import { Trees } from "./landscape/Trees";
import { Walls } from "./landscape/Walls";

export function Landscape() {
  return (
    <group>
      <Walls />
      <Pools />
      <Playground />
      <Trees />
      <Planting />
      <PathLights />
    </group>
  );
}
