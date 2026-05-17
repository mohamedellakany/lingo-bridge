import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import translateRouter from "./translate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(translateRouter);

export default router;
