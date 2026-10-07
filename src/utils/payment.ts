export function calculateDueDate(paymentTermsDays: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + paymentTermsDays);
    return date;
  }