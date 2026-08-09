import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy namespace — every /free/@handle URL now lives at /u/@handle. */
export const Route = createFileRoute("/free/@{$username}")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/u/@{$username}",
      params: { username: (params as { username: string }).username },
      replace: true,
    });
  },
});
