import { Router, type IRouter } from "express";
import healthRouter from "./health";
import networkRouter from "./network";

const router: IRouter = Router();

router.use(healthRouter);
router.use(networkRouter);

export default router;
