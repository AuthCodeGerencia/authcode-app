declare module "*.svg" {
  import type { SvgProps } from "react-native-svg";
  import type { ComponentType } from "react";

  const content: ComponentType<SvgProps>;
  export default content;
}

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_CONVEX_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
