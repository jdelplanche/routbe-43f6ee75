import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** SSR-safe public profile fetch used by every link-hub route. */
export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ username: z.string().min(1).max(60) }).parse(data))
  .handler(async ({ data }) => {
    const { loadPublicProfile } = await import("@/lib/public-profile.server");
    return loadPublicProfile(data.username);
  });
