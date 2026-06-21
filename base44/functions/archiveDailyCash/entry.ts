import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const collections = await base44.asServiceRole.entities.CashCollection.filter({
      is_archived: false
    });

    if (collections.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Aucune collecte à archiver',
        archived: 0
      });
    }

    const now = new Date().toISOString();
    const updates = await Promise.all(
      collections.map(collection =>
        base44.asServiceRole.entities.CashCollection.update(collection.id, {
          is_archived: true,
          archived_date: now
        })
      )
    );

    return Response.json({
      success: true,
      message: `${updates.length} collectes archivées`,
      archived: updates.length,
      total: collections.reduce((sum, c) => sum + c.amount, 0)
    });

  } catch (error) {
    console.error('Erreur archivage:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});