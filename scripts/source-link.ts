export const sourceUrlFrom = ({
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
  SOURCE_SHA,
}: Readonly<Record<string, string | undefined>>) =>
  GITHUB_SERVER_URL && GITHUB_REPOSITORY && SOURCE_SHA
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${SOURCE_SHA}`
    : undefined;
