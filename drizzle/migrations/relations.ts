import { relations } from "drizzle-orm/relations";
import { user, userStatusLogs } from "./schema";

export const userRelations = relations(user, ({one, many}) => ({
	user: one(user, {
		fields: [user.statusChangedBy],
		references: [user.id],
		relationName: "user_statusChangedBy_user_id"
	}),
	users: many(user, {
		relationName: "user_statusChangedBy_user_id"
	}),
	userStatusLogs_userId: many(userStatusLogs, {
		relationName: "userStatusLogs_userId_user_id"
	}),
	userStatusLogs_operatorId: many(userStatusLogs, {
		relationName: "userStatusLogs_operatorId_user_id"
	}),
}));

export const userStatusLogsRelations = relations(userStatusLogs, ({one}) => ({
	user_userId: one(user, {
		fields: [userStatusLogs.userId],
		references: [user.id],
		relationName: "userStatusLogs_userId_user_id"
	}),
	user_operatorId: one(user, {
		fields: [userStatusLogs.operatorId],
		references: [user.id],
		relationName: "userStatusLogs_operatorId_user_id"
	}),
}));