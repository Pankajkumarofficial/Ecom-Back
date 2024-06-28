import { User } from "../models/userSchema.js";
import ErrorHandler from "../utils/utility-class.js";
import { TryCatch } from "./error.js";

export const adminOnly = TryCatch(async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        return next(new ErrorHandler("Please Login first", 401))
    }
    const user = await User.findById(id)
    if (!user) {
        return next(new ErrorHandler("Enter register id", 400))
    }
    if (user.role !== "admin") {
        return next(new ErrorHandler("You are not an admin", 400))
    }
    next()
})