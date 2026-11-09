import { PROXY_BASE_PATH } from "@weather-widget/proxy";
import { PROXY_DEV_ORIGIN } from "@weather-widget/proxy/dev-server";

export default {
  [PROXY_BASE_PATH]: { target: PROXY_DEV_ORIGIN },
};
