import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createItemValidationSchema,
  updateItemValidationSchema,
  itemIdParamValidationSchema,
  listItemsValidationSchema,
} from "./validators";

/**
 * Template routes (Khumbaya shape). To use:
 *  1. Copy `src/modules/_template` -> `src/modules/<name>`
 *  2. Rename paths below, adjust authCheckType to your roles
 *  3. Add "<name>" to routeConfig in src/routes/plugin.ts
 */
const routes = [
  {
    method: "get",
    path: "template",
    controller: Controller.list,
    validation: validate(listItemsValidationSchema),
  },
  {
    method: "get",
    path: "template/:id",
    controller: Controller.list,
    validation: validate(itemIdParamValidationSchema),
  },
  {
    method: "post",
    path: "template",
    controller: Controller.create,
    authorization: true,
    validation: validate(createItemValidationSchema),
  },
  {
    method: "patch",
    path: "template/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateItemValidationSchema),
  },
  {
    method: "delete",
    path: "template/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(itemIdParamValidationSchema),
  },
];

export default routes;
