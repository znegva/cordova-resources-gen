import * as fs from "fs-extra";
import * as gm from "gm";
import { ItargetSpec, IsplashDefinition, getImageDim } from "./extra";

import { androidSplashDefaults, iosSplashDefaults } from "./splashspecs";

function generateTarget(
  sourceFile: string,
  targetDir: string,
  target: ItargetSpec
): void {
  if (sourceFile === target.fileName) {
    console.error(
      `Skipping ${target.fileName}, output would overwrite input file`
    );
    return;
  }

  let applyNinePatch = target.fileName.indexOf(".9.png") > -1;

  fs.exists(sourceFile, async exists => {
    if (exists) {
      //create output dir, if needed
      fs.ensureDirSync(targetDir);

      let im = gm.subClass({
        imageMagick: true
      });

      let sourceDim: gm.Dimensions = await getImageDim(sourceFile, im);

      //open the input file
      let convert = im(sourceFile);

      //REVIEW: maybe we should flatten input files (layers etc)

      //if the target is larger than the input, we fill up
      //no filling needed if we want nine-patch (which will be applied later!)
      if (
        (sourceDim.height < target.height || sourceDim.width < target.width) &&
        !applyNinePatch
      ) {
        //fill up until target specs are met! WE NEVER SCALE UP!
        console.log("filling the splash, its too small");
        let paddingVer = Math.floor((target.height - sourceDim.height) / 2);
        let paddingHor = Math.floor((target.width - sourceDim.width) / 2);
        convert = convert
          .in("-define")
          .in(
            "distort:viewport=" +
              target.width +
              "x" +
              target.height +
              "-" +
              paddingHor +
              "-" +
              paddingVer
          )
          .in("-distort")
          .in("SRT")
          .in("0")
          .in("+repage");
      } else {
        //we need to crop and/or resize
        //first resize to biggest dimension
        convert = convert.resize(target.width, target.height, "^");
        //crop anything we dont want
        convert = convert
          .gravity("Center")
          .crop(target.width, target.height, 0, 0);
        //convert = convert.in("-resize").in(`${spec.width}x${spec.height}`);
      }

      //now we have the correctly sized image (as defined in spec),
      //see if we also want to apply nine-patch
      if (applyNinePatch) {
        // extent with 1px transparent border
        convert = convert.borderColor("none").border(1, 1);

        // draw black pixels
        convert = convert
          .fill("black")

          // stretchable area
          .drawPoint(1, 0)
          .drawPoint(target.width, 0)
          .drawPoint(0, 1)
          .drawPoint(0, target.height)

          // padding box (required since API 21)
          .drawLine(target.width + 1, 1, target.width + 1, target.height)
          .drawLine(1, target.height + 1, target.width, target.height + 1);
      }

      //dont store color profile
      convert = convert.noProfile();

      //save the file
      convert.write(targetDir + target.fileName, error => {
        if (error) {
          console.log(
            `Could not write ${target.fileName}, please check your config.`
          );
        } else {
          console.log(
            `Generating ${target.fileName} finished. ${
              applyNinePatch ? "(Nine-Patch applied)" : ""
            }`
          );
        }
      });
    } else {
      console.log(`Sourcefile ${sourceFile} not found, skipping.`);
    }
  });
}

//lets try it
export function generateTargets(def: IsplashDefinition) {
  def.targets.forEach(target => {
    generateTarget(def.sourceFile, def.targetDir, target);
  });
}

generateTargets(androidSplashDefaults);
generateTargets(iosSplashDefaults);