from dataclasses import dataclass
STAGES=['order_placed','packed','shipped','out_for_delivery','delivered']
@dataclass
class CourierProvider:
    name: str = 'Mock'
    def create_shipment(self, shipment_id):
        return {'provider':self.name,'tracking_code':f'BM{shipment_id:06d}','stage':STAGES[0]}
    def advance(self, stage):
        i=STAGES.index(stage) if stage in STAGES else 0
        return STAGES[min(i+1,len(STAGES)-1)]
class MockCourier(CourierProvider): pass
class ShiprocketCourier(CourierProvider):
    def __init__(self): super().__init__('Shiprocket')
class DelhiveryCourier(CourierProvider):
    def __init__(self): super().__init__('Delhivery')
