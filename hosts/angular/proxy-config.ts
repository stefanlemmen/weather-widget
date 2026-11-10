import { PROXY_BASE_PATH } from "@weather-widget/contract";
import { PROXY_DEV_ORIGIN } from "@weather-widget/contract/dev-server";

export default {
  [PROXY_BASE_PATH]: { target: PROXY_DEV_ORIGIN },
};
