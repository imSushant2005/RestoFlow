type OrderPayloadDb = {
  menuItem: {
    findMany: (args: any) => Promise<any[]>;
  };
};

export async function buildServerPricedOrderPayload(db: OrderPayloadDb, tenantId: string, items: any[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ORDER_ITEMS_REQUIRED');
  }

  const normalizedItems = items.map((item) => ({
    menuItemId: String(item?.menuItemId || item?.menuItem?.id || '').trim(),
    quantity: Math.max(1, Number(item?.quantity) || 1),
    notes: typeof item?.notes === 'string' ? item.notes.trim() : typeof item?.specialNote === 'string' ? item.specialNote.trim() : '',
    selectedModifierIds: Array.from(
      new Set(
        (Array.isArray(item?.selectedModifierIds)
          ? item.selectedModifierIds
          : Array.isArray(item?.selectedModifiers)
            ? item.selectedModifiers.map((modifier: any) => modifier?.id)
            : Array.isArray(item?.modifiers)
              ? item.modifiers.map((modifier: any) => modifier?.id)
              : []
        )
          .map((value: any) => String(value || '').trim())
          .filter(Boolean),
      ),
    ),
  }));

  if (normalizedItems.some((item) => !item.menuItemId)) {
    throw new Error('ORDER_ITEMS_INVALID');
  }

  const menuItems: any[] = await db.menuItem.findMany({
    where: {
      tenantId,
      isAvailable: true,
      id: { in: normalizedItems.map((item) => item.menuItemId) },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      images: true,
      isVeg: true,
      modifierGroups: {
        select: {
          id: true,
          name: true,
          isRequired: true,
          minSelections: true,
          maxSelections: true,
          modifiers: {
            where: { isAvailable: true },
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
            },
          },
        },
      },
    },
  });

  const menuMap = new Map<string, any>(menuItems.map((menuItem: any) => [menuItem.id, menuItem]));
  let subtotal = 0;

  const orderItems = normalizedItems.map((item) => {
    const menuItem = menuMap.get(item.menuItemId);
    if (!menuItem) {
      throw new Error(`MENU_ITEM_NOT_FOUND:${item.menuItemId}`);
    }

    const availableModifierIds = new Set(
      (menuItem.modifierGroups || []).flatMap((group: any) => (group.modifiers || []).map((modifier: any) => modifier.id)),
    );

    if (item.selectedModifierIds.some((modifierId) => !availableModifierIds.has(modifierId))) {
      throw new Error(`MODIFIER_NOT_FOUND:${menuItem.id}`);
    }

    let unitPrice = Number(menuItem.price || 0);
    const selectedModifiers: Array<{ id: string; name: string; groupName: string; priceAdjustment: number }> = [];

    for (const group of menuItem.modifierGroups || []) {
      const groupMinSelections = Math.max(0, Number(group.minSelections || 0));
      const groupMaxSelections = Math.max(1, Number(group.maxSelections || 1));
      const groupSelections = (group.modifiers || []).filter((modifier: any) => item.selectedModifierIds.includes(modifier.id));

      if (groupSelections.length < groupMinSelections) {
        throw new Error(`MODIFIER_REQUIRED:${group.name}`);
      }

      if (groupSelections.length > groupMaxSelections) {
        throw new Error(`MODIFIER_LIMIT:${group.name}`);
      }

      groupSelections.forEach((modifier: any) => {
        const priceAdjustment = Number(modifier.priceAdjustment || 0);
        unitPrice += priceAdjustment;
        selectedModifiers.push({
          id: modifier.id,
          name: modifier.name,
          groupName: group.name,
          priceAdjustment,
        });
      });
    }

    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      description: menuItem.description || '',
      imageUrl: menuItem.images?.[0] || null,
      unitPrice,
      quantity: item.quantity,
      totalPrice,
      selectedModifiers,
      specialNote: item.notes || null,
      isVeg: menuItem.isVeg,
    };
  });

  return {
    subtotal,
    orderItems,
  };
}
