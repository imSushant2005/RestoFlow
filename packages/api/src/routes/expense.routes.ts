import { Router } from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expense.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(requireAuth);

router.get('/', getExpenses);
router.post('/', createExpense);
router.delete('/:id', deleteExpense);

export default router;
