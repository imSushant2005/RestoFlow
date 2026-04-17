import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(expenses);
  } catch (error) {
    console.error('FETCH_EXPENSES_ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { description, amount, category, date } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ error: 'Description and amount are required' });
    }

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        description,
        amount: Number(amount),
        category: category || 'General',
        date: date ? new Date(date) : new Date(),
      },
    });

    res.json(expense);
  } catch (error) {
    console.error('CREATE_EXPENSE_ERROR:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await prisma.expense.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE_EXPENSE_ERROR:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};
