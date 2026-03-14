from sqlalchemy.orm import Session
import models
from datetime import datetime, timezone

class InventoryService:
    @staticmethod
    def record_movement(db: Session, user_id: str, product_id: int, change: float, ref_type: str, ref_id: int = None, notes: str = None, unit_cost: float = None):
        product = db.query(models.ProductItem).filter(
            models.ProductItem.id == product_id, 
            models.ProductItem.user_id == user_id
        ).first()
        
        if not product:
            return None
        
        # Calculate new Average Cost if it's a stock increase and unit_cost is provided
        if change > 0 and unit_cost is not None:
            old_qoh = product.quantity_on_hand if product.quantity_on_hand > 0 else 0
            new_qoh = old_qoh + change
            
            # Formula: (old_total_value + added_value) / new_quantity
            old_total_value = old_qoh * product.average_cost
            added_value = change * unit_cost
            
            if new_qoh > 0:
                product.average_cost = (old_total_value + added_value) / new_qoh
            else:
                product.average_cost = unit_cost
        
        # Update Quantity on Hand
        product.quantity_on_hand += change
        
        # Log Movement
        movement = models.InventoryMovement(
            user_id=user_id,
            product_id=product_id,
            change_amount=change,
            new_quantity=product.quantity_on_hand,
            reference_type=ref_type,
            reference_id=ref_id,
            notes=notes,
            date=datetime.now(timezone.utc)
        )
        db.add(movement)
        return movement

    @staticmethod
    def handle_po_receipt(db: Session, user_id: str, po_id: int, items_received: list):
        """
        Processes items received from a PO and updates inventory.
        items_received: list of dicts {'item_id': int, 'received': float} 
        where item_id is the POLineItem ID.
        """
        for recv in items_received:
            po_item = db.query(models.POLineItem).filter(models.POLineItem.id == recv['item_id']).first()
            if po_item and po_item.product_id:
                # Update inventory for the associated product with the PO unit price
                InventoryService.record_movement(
                    db, user_id, po_item.product_id, recv['received'], "PURCHASE", 
                    ref_id=po_id, unit_cost=po_item.unit_price
                )
