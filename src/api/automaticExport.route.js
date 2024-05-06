import express from "express";
import { createJob, deleteJob } from "../agenda/jobs/automaticExportJob";

const router = express.Router();

const JOB_PRIORITY = "high";

router.post('/create', (req, res) => {
    const { schedule } = req.body;
    createJob(
        {
            schedule,
            priority: JOB_PRIORITY
        },
        schedule.repeat,
        () => {
            res.send({ message: 'Automatic audit export created!' });
        }
    )
});

router.post('/delete', (req, res) => {
    const { formData } = req.body;
    deleteJob(
        {
            formData
        },
        () => {
            res.send({ message: 'Automatic audit export deleted!' });
        }
    )
});

export default router;