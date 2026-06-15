import { Router, type IRouter } from "express";
import healthRouter from "./health";
import networkRouter from "./network";
import vpnRouter from "./vpn";

const router: IRouter = Router();

router.use(healthRouter);
router.use(networkRouter);
router.use(vpnRouter);

export default router;
