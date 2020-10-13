from io import BytesIO
from typing import Optional
import msgpack

class Serializable:
    fields = []

    @classmethod
    def deserialize(cls, data: bytes) -> Optional['Serializable']:
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(buffer)
            instance = cls()
            for field in instance.fields:
                print(field)
                setattr(instance, field, unpacker.unpack())
            return instance
    
    def serialize(self) -> bytes:
        packer = msgpack.Packer(autoreset=False)
        for field in self.fields:
            print(field)
            packer.pack(getattr(self, field))
        return packer.bytes()

class TestObject(Serializable):
    fields = ["someString", "someInt"]

    def __init__(self):
        super().__init__()
        self.someString = "this is a string"
        self.someInt = 123

class SubObject(TestObject):
    fields = ["additionalField"]

    def __init__(self):
        super().__init__()
        self.additionalField = "this should be added to the others"
        print(self.__class__.mro())

data = SubObject().serialize()
print(data)
print(len(data))

restored = SubObject.deserialize(data)
print(isinstance(restored, TestObject)) # True
