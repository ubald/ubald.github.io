from abc import ABCMeta, abstractmethod
from collections import OrderedDict
from io import BytesIO
from typing import Generic, TypeVar, ClassVar, Any, Dict, Optional, Type

import msgpack


T = TypeVar('T')


class CustomSerializer(Generic[T], metaclass=ABCMeta):

    def __init_subclass__(cls, code: int):
        Serializable.add_custom_serializer(code=code, serializer=cls())

    @abstractmethod
    def serialize(self, obj: T) -> Optional[bytes]:
        """
        This method should return a bytes representation of obj
        if it is able to serialize it and None if it doesn't
        support the serialization of obj.
        """
        pass

    @abstractmethod
    def deserialize(self, data: bytes) -> Optional[T]:
        """
        This method should return an instance of T from
        the bytes in data or None if there was an error.
        """
        pass


class SerializableMeta(type):
    def __call__(cls, *args, **kwargs):
        obj = type.__call__(cls, *args, **kwargs)
        obj.initialize()
        return obj


class Serializable(metaclass=SerializableMeta):
    _classes: ClassVar[Dict[int, Type['Serializable']]] = dict()
    _serializers: ClassVar[Dict[int, CustomSerializer]] = dict()

    def __init_subclass__(cls, id: int):
        if id in Serializable._classes:
            raise Exception(
                f"Class id \"{id}\" already used by \"{Serializable._classes[id].__name__}\"")
        Serializable._classes[id] = cls

        cls._class_id = id
        cls._fields = list(OrderedDict.fromkeys([
            field for fields in [
                c.fields for c in reversed(cls.__mro__)
                if hasattr(c, 'fields') and c.fields is not None
            ] for field in fields
        ]))

    @classmethod
    def ext_hook(cls, code: int, data: bytes) -> Any:
        serializer = cls._serializers.get(code)
        if serializer:
            return serializer.deserialize(data)

    @classmethod
    def deserialize(cls, data: bytes) -> Optional['Serializable']:
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(
                buffer, ext_hook=cls.ext_hook, raw=False)

            class_id = unpacker.unpack()
            cls = Serializable._classes.get(class_id)
            if not cls:
                return None

            instance = cls.__new__(cls)
            for field in cls._fields:
                print(f"Deserializing: {field}")
                setattr(instance, field, unpacker.unpack())

            return instance

    @classmethod
    def add_custom_serializer(cls, code: int, serializer: CustomSerializer) -> None:
        if code in cls._serializers:
            raise Exception(f"Serializer code {code} already in use")
        cls._serializers[code] = serializer

    def initialize(self):
        """Placeholder, should be overridden if necessary"""
        pass

    def serialize(self) -> bytes:
        def default(obj: Any) -> msgpack.ExtType:
            for code, serializer in self._serializers.items():
                data = serializer.serialize(obj)
                if data:
                    return msgpack.ExtType(code, data)
            raise TypeError(f"Unknown type encountered: {obj}")

        packer = msgpack.Packer(default=default, autoreset=False)

        packer.pack(self._class_id)

        for field in self.__class__._fields:
            print(f"Serializing: {field}")
            packer.pack(getattr(self, field))

        return packer.bytes()


class SerializableSerializer(CustomSerializer[Serializable], code=0x00):

    def serialize(self, obj: Serializable) -> Optional[bytes]:
        print(obj, isinstance(obj, Serializable))
        if not isinstance(obj, Serializable):
            return None
        return obj.serialize()

    def deserialize(self, data: bytes) -> Optional[Serializable]:
        return Serializable.deserialize(data)
