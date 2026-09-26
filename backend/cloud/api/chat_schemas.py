import os
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ChatQueryIn(BaseModel):
    query: str

class ChatQueryOut(BaseModel):
    response: str
