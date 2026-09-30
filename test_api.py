import asyncio
from cloud.ai_engine.service import PredictiveAIService

class MockDB:
    async def execute(self, stmt):
        class MockResult:
            def scalar_one_or_none(self):
                return None
        return MockResult()
    def add(self, obj):
        print("adding", obj)
    async def commit(self):
        print("commit")

async def main():
    service = PredictiveAIService.get_instance()
    res = await service.predict_algorithmic_v2("maitri", MockDB())
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
