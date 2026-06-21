import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Archive the month that just ended
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month

    const monthLabel = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, '0')}`;

    const allOrders = await base44.asServiceRole.entities.Order.list('-created_date', 2000);

    const monthOrders = allOrders.filter(order => {
      if (order.payment_method === 'card' && order.status === 'pending') return false;
      const d = new Date(order.created_date);
      return d >= prevMonthStart && d <= new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate(), 23, 59, 59);
    });

    const totalRevenue = monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const orderCount = monthOrders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    const existing = await base44.asServiceRole.entities.RevenueHistory.filter({ period_type: 'monthly', period_label: monthLabel });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.RevenueHistory.update(existing[0].id, {
        total_revenue: totalRevenue,
        order_count: orderCount,
        average_order_value: averageOrderValue
      });
    } else {
      await base44.asServiceRole.entities.RevenueHistory.create({
        period_type: 'monthly',
        period_label: monthLabel,
        period_start: prevMonthStart.toISOString().split('T')[0],
        period_end: prevMonthEnd.toISOString().split('T')[0],
        total_revenue: totalRevenue,
        order_count: orderCount,
        average_order_value: averageOrderValue
      });
    }

    // Archive weekly stats for each week of the previous month
    for (let week = 0; week < 5; week++) {
      const weekStart = new Date(prevMonthStart);
      weekStart.setDate(1 + week * 7);
      if (weekStart > prevMonthEnd) break;

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      if (weekEnd > prevMonthEnd) weekEnd.setTime(prevMonthEnd.getTime());

      const weekOrders = allOrders.filter(order => {
        if (order.payment_method === 'card' && order.status === 'pending') return false;
        const d = new Date(order.created_date);
        return d >= weekStart && d <= new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59);
      });

      const weekNum = week + 1;
      const weekLabel = `${monthLabel}-S${weekNum}`;
      const weekRevenue = weekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const weekCount = weekOrders.length;

      const existingWeek = await base44.asServiceRole.entities.RevenueHistory.filter({ period_type: 'weekly', period_label: weekLabel });
      if (existingWeek.length > 0) {
        await base44.asServiceRole.entities.RevenueHistory.update(existingWeek[0].id, {
          total_revenue: weekRevenue,
          order_count: weekCount,
          average_order_value: weekCount > 0 ? weekRevenue / weekCount : 0
        });
      } else {
        await base44.asServiceRole.entities.RevenueHistory.create({
          period_type: 'weekly',
          period_label: weekLabel,
          period_start: weekStart.toISOString().split('T')[0],
          period_end: weekEnd.toISOString().split('T')[0],
          total_revenue: weekRevenue,
          order_count: weekCount,
          average_order_value: weekCount > 0 ? weekRevenue / weekCount : 0
        });
      }
    }

    // Archive daily stats for each day of the previous month
    for (let d = 1; d <= prevMonthEnd.getDate(); d++) {
      const dayDate = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), d);
      const dayLabel = dayDate.toISOString().split('T')[0];

      const dayOrders = allOrders.filter(order => {
        if (order.payment_method === 'card' && order.status === 'pending') return false;
        const od = new Date(order.created_date);
        return od.toDateString() === dayDate.toDateString();
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const dayCount = dayOrders.length;

      const existingDay = await base44.asServiceRole.entities.RevenueHistory.filter({ period_type: 'daily', period_label: dayLabel });
      if (existingDay.length > 0) {
        await base44.asServiceRole.entities.RevenueHistory.update(existingDay[0].id, {
          total_revenue: dayRevenue,
          order_count: dayCount,
          average_order_value: dayCount > 0 ? dayRevenue / dayCount : 0
        });
      } else {
        await base44.asServiceRole.entities.RevenueHistory.create({
          period_type: 'daily',
          period_label: dayLabel,
          period_start: dayLabel,
          period_end: dayLabel,
          total_revenue: dayRevenue,
          order_count: dayCount,
          average_order_value: dayCount > 0 ? dayRevenue / dayCount : 0
        });
      }
    }

    return Response.json({ success: true, message: `Mois ${monthLabel} archivé avec succès`, orders_archived: orderCount, revenue: totalRevenue });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});