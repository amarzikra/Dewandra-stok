import { createFileRoute } from "@tanstack/react-router";
import { ApiError, readJson, withApiSession } from "@/lib/api.server";
import {
  DuplicateEmailError,
  updateProfile,
} from "@/services/users.service.server";
import { updateProfileSchema } from "@/validators/stores";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      PATCH: ({ request }) =>
        withApiSession(request, async (session) => {
          const input = updateProfileSchema.parse(await readJson(request));
          try {
            const account = await updateProfile(session.user.id, input);
            if (!account)
              throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
            return Response.json({ data: account });
          } catch (error) {
            if (error instanceof DuplicateEmailError)
              throw new ApiError(409, "DUPLICATE_EMAIL", error.message);
            throw error;
          }
        }),
    },
  },
});
