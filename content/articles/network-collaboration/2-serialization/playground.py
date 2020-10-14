from collections import OrderedDict
from io import BytesIO
from typing import ClassVar, Dict, List, Optional, Type

import msgpack


class SerializableMeta(type):
    def __call__(cls, *args, **kwargs):
        obj = type.__call__(cls, *args, **kwargs)
        obj.initialize()
        return obj


class Serializable(metaclass=SerializableMeta):
    _classes: ClassVar[Dict[int, Type['Serializable']]] = dict()
    
    def __call__(cls):
        print(cls)
        print(cls)
        print(cls)
        print(cls)
        print(cls)

    def __init_subclass__(cls, id: int):
        if id in Serializable._classes:
            raise Exception(f"Class id \"{id}\" already used by \"{Serializable._classes[id].__name__}\"")
        Serializable._classes[id] = cls

        cls._class_id = id
        cls._fields = list(OrderedDict.fromkeys([
            field for fields in [
                c.fields for c in reversed(cls.__mro__) \
                    if hasattr(c, 'fields') and c.fields is not None
            ] for field in fields
        ]))

    @staticmethod
    def deserialize(data: bytes) -> Optional['Serializable']:
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(buffer, raw=False)

            class_id = unpacker.unpack()
            cls = Serializable._classes.get(class_id)
            if not cls:
                return None

            instance = cls.__new__(cls)
            for field in cls._fields:
                print(f"Deserializing: {field}")
                setattr(instance, field, unpacker.unpack())

            return instance
    
    def initialize(self):
        """Placeholder, should be overridden if necessary"""
        pass
    
    def serialize(self) -> bytes:
        packer = msgpack.Packer(autoreset=False)

        packer.pack(self._class_id)

        for field in self.__class__._fields:
            print(f"Serializing: {field}")
            packer.pack(getattr(self, field))

        return packer.bytes()

# class TestObject(Serializable, id=0x00):
#     fields = ["someString", "someInt"]

#     def __init__(self):
#         super().__init__()
#         self.someString = "this is a string"
#         self.someInt = 123

# class SubObject(TestObject, id=0x01):
#     fields = ["additionalField"]

#     def __init__(self):
#         super().__init__()
#         self.additionalField = "this should be added to the others"

# class SubSubObject(SubObject, id=0x02):
#     fields = ["uselessField"]

#     def __init__(self):
#         super().__init__()
#         self.uselessField = "this is useless"

class Sample(Serializable, id=0x00):
    fields = ["foo"]

    def __init__(self, foo:str = None):
        self.foo = foo
        print(self.foo)

sample = Sample("Hello World!")
data = sample.serialize()
restored = Serializable.deserialize(data)
print(restored.foo)

# print("-")
# data = TestObject().serialize()
# print("-")
# data = SubObject().serialize()
# print("-")
# data = TestObject().serialize()
# print("-")
# data = SubObject().serialize()
# print("-")
# print(data)
# print(len(data))

# restored = Serializable.deserialize(data)
# print(isinstance(restored, TestObject)) # True
