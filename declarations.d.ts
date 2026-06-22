declare module "*.svg" {
  import type { SvgProps } from "react-native-svg";
  import type { ComponentType } from "react";

  const content: ComponentType<SvgProps>;
  export default content;
}
