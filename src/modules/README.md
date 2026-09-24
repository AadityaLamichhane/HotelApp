// Copy file: `modules/<name>/{controller,service,model,route,schema,validators}.ts`
// 1. Define zod schemas in `validators.ts` as `{ body, query, params }`
//    (Khumbaya style) and export inferred types with `z.infer`.
// 2. Attach with `validation: validate(YourSchema)` in `route.ts`.
// 3. Throw via `throwErrorOnValidation` / `throwNotFoundError` in services.
// 4. Register the folder name in `src/routes/plugin.ts` routeConfig.
//
// See `src/modules/_template/*` for a complete copy-paste example.

// Example — replace with your real module (e.g. rooms, bookings):
//
// // validators.ts
// import { z } from "zod";
// export const createRoomValidationSchema = z.object({
//   body: z.object({ name: z.string().min(1, "Name is required") }),
// });
// export type CreateRoomInput = z.infer<typeof createRoomValidationSchema>;
//
// // route.ts
// import Controller from "./controller";
// import { validate } from "@/middlewares/zodValidation";
// import { createRoomValidationSchema } from "./validators";
// export default [
//   { method: "post", path: "rooms", controller: Controller.create,
//     validation: validate(createRoomValidationSchema) },
// ];
export {};
