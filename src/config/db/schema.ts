// Central drizzle schema — drizzle-kit reads ONLY this file
// (see drizzle.config.ts). Every module table must be re-exported here
// in FK order: users -> admins -> hotels -> rooms.
import { usersSchema } from "@/modules/users/schema";
import { adminsSchema } from "@/modules/admin/schema";
import { hotelsSchema } from "@/modules/hotels/schema";
import { roomschema, roomEntrySchema } from "@/modules/rooms/schema";

export { usersSchema, adminsSchema, hotelsSchema, roomschema, roomEntrySchema };
