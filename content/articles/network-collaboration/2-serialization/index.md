---
title: Python Class Serialization
slug: serialization
categories:
    - code
tags:
    - serialization
    - python
    - msgpack
poster: images/stock/pigeons.jpg
date: 2020-10-20T00:00:00.000Z
---

The first step to tackle before diving into the networking library is the data serialization. It is generic enough to be developed in isolation and will come in handy when the time comes to send and receive test data later in the library development.

###### What is serialization?

Serialization is the process of converting objects into a textual or binary format so that they can be stored or transmitted and restored later. The reverse process is called deserialization, where that same textual or binary data is restored into the original objects that were serialized.

### Different approaches to serialization

There are different approaches to serialization each with their pros ans cons. Here it's important to define what we want from our serialization and how we want to use it. Some ready-made solutions, like simply using a JSON encoder might be enticing at first but it doesn't always end up being the right solution. While a simple JSON stringification might be the right approach for some projects, in our case we are developing for a networked editor that will stream animated 3D scenes to multiple clients simultaneously so we have a specific set of requirements.

#### Our requirements

-   Encoding/decoding must be _fast_
-   Encoded data must be lightweight
-   It should not only serialize plain objects but be able to restore to class instances
-   It should be easy to add serialization to a class

##### Sample code

Let's use this simple class as a sample object to serialize.

```python
class TestObject:
    def __init__(self):
        self.someString = "this is a string"
        self.someInt = 123
```

##### Using JSON

We can use the [JSON](https://docs.python.org/3/library/json.html) encoding from the standard library. With it we can't directly serialize a class instance to JSON, but we can encode the instance's `__dict__` like this:

```python
import json

data = json.dumps(TestObject(), default=lambda x: x.__dict__)
print(data) # { "someString": "this is a string", "someInt": 123 }
print(len(data)) # 50
```

This amounts to 50 bytes of data, which is more than just the space required for the values. Including property names in JSON is useful to restore plain objects and for human readability but it takes valuable space. Additionally, all the markup necessary to delimit property names and values, the double-quotes, colons and brackets, use valuable bytes in the serialized payload.

##### Using Pickle

Another option from the standard library is [pickle](https://docs.python.org/3/library/pickle.html). It allows for an efficient binary representation of objects that can easily be restored to instances of the original class. Let use the same sample class and see how the output compares.

```python
import pickle

data = pickle.dumps(TestObject())
print(data) # b'\x80\x04\x95O\x00\x00\x00\x00\x00\x00\x00\x8c\x08__main__\x94\x8c\nTestObject\x94\x93\x94)\x81\x94}\x94(\x8c\nsomeString\x94\x8c\x10this is a string\x94\x8c\x07someInt\x94K{ub.'
print(len(data)) # 90
```

This amounts to 90 bytes of data, substantially more than JSON. Fortunately, this format allows for direct reconstruction of the original instance which can be demonstrated like this:

```python
import pickle

data = pickle.dumps(TestObject())
restored = pickle.loads(data)
print(isinstance(restored, TestObject)) # True
```

but it is still _a lot_ of data to move around if we want to be efficient. Also, another downside of this method is that this format is Python-specific. If we were to implement a client in a language other that Python, we'd need to re-implement this Python encoding in another language.

##### Using MessagePack

Another popular option is [MessagePack](https://msgpack.org/), it offers implementations for most languages, giving us a certain level of compatibility if we were to implement a client in another language. We'll continue with our basic test here using the [official python implementation](https://github.com/msgpack/msgpack-python).

```python
import msgpack

data = msgpack.dumps(TestObject(), default=lambda x: x.__dict__)
print(data) # b'\x82\xaasomeString\xb0this is a string\xa7someInt{'
print(len(data)) # 38
```

This option is already looking promising. We're at 38 bytes, our best result so far, but there are two issues that remain: the property names are still included and we can't restore this to a class instance. Fortunately, MessagePack is flexible enough for us to develop something custom that will fix those issues.

#### Improving the MessagePack serialization

The first thing we can to to improve the serialization payload is to remove the property names from the output. The way we can do this is by using a custom `Packer` and pack (serialize) values manually one by one without including the property names. We have to be careful to deserialize the values in the same order they were serialized in order to read the correct bytes. Here is an exploration of what that might look like, plus the code required to deserialize the payload too.

```python
from io import BytesIO
import msgpack

class TestObject:
    def __init__(self):
        self.someString = "this is a string"
        self.someInt = 123

    def serialize(self) -> bytes:
        # We don't want to reset the packer's buffer between calls to `pack()`
        # `autoreset=false` does that and allow us to retrieve the buffer with `bytes()`
        packer = msgpack.Packer(autoreset=False)
        packer.pack(self.someString)
        packer.pack(self.someInt)
        return packer.bytes()

    @staticmethod
    def deserialize(data: bytes) -> 'TestObject':
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(buffer, raw=False)
            instance = TestObject()
            instance.someString = unpacker.unpack()
            instance.someInt = unpacker.unpack()
            return instance

data = TestObject().serialize()
print(data) # b'\xb0this is a string{'
print(len(data)) # 18

restored = TestObject.deserialize(data)
print(isinstance(restored, TestObject)) # True
```

Space wise this is a huge improvement over the previous solutions we've tried. We still haven't found a way to automatically deserialize into an instance of the class, we have to know the class in advance in order to call `deserialize` on it. Something that is instantly apparent, though, is that this is already starting to become a lot of work to serialize only two values. Even if we were to move the repeating code into a base class, we would still need to pack and unpack each property manually in every serializable class we would implement.

One of our goals is still to make this library easy to use with as little overhead as possible. The ideal usage scenario here would be for a user to simply list the properties they want serialized and the rest being handled automatically. Ideally we would like our class to look like this and still produce the same results:

```python
class TestObject(Serializable):
    fields = ["someString", "someInt"]

    def __init__(self):
        super().__init__()
        self.someString = "this is a string"
        self.someInt = 123
```

An initial implementation of this `Serializable` class might look like the following:

```python
class Serializable:
    fields: ClassVar[List[str]] = []

    @classmethod
    def deserialize(cls, data: bytes) -> 'Serializable':
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(buffer, raw=False)
            instance = cls()
            for field in instance.fields:
                setattr(instance, field, unpacker.unpack())
            return instance

    def serialize(self) -> bytes:
        packer = msgpack.Packer(autoreset=False)
        for field in self.fields:
            packer.pack(getattr(self, field))
        return packer.bytes()
```

From this point, we can look at how to improve this early prototype of a serializable class and progressively transform it into something more flexible. For starters, this won't let us extend from a serializable class and add fields to it because `fields` ends up being overwritten by the new subclass. In order to do this we need to be able to traverse the class hierarchy and accumulate fields that are defined at each level. For this we'll use this mouthful in the `Serializable` constructor:

```python
def __init_subclass__(cls):
    cls._fields = list(OrderedDict.fromkeys([
        field for fields in [
            c.fields for c in reversed(cls.__mro__) \
                if hasattr(c, 'fields') and c.fields is not None
        ] for field in fields
    ]))
```

First of all, it uses [`__init_subclass__`](https://docs.python.org/3/reference/datamodel.html#object.__init_subclass__) which is a method called whenever the containing class is subclassed. This allows us to initialize the list of serializable fields only once per subclass and store the results to a class variable. It leverages the class [MRO](https://docs.python.org/3/library/stdtypes.html?highlight=mro#class.__mro__) (Method Resolution Order) to traverse the class hierarchy in the same fashion Python would to resolve methods. Then, fields are accumulated, deduplicated and saved to be reused by the `serialize` and `deserialize` methods.

Now that we have an easy way to define the serializable fields, the next thing to improve would be to add support for automatic restoration of serialized data into its original class. For this we'll need to create a registry to store associations between some identifier and the classes. A natural choice for the identifier would be the class name, it would even be easy to add this to `__init_subclass__` to automate the registration. But we need to remember our goal of having the smallest payload possible. A class name would use valuable space when transmitting serialized class instances over the network. Besides, if we keep in mind the context of the collaborative editing framework, we might want to interoperate with systems that might not be built in Python therefore might not have a direct equivalent to the class names. For that, we'll simply use a single byte to identify classes, we can always add a second byte later to group serializable classes by categories (more on that later, but something along the lines of grouping commands, requests, notifications, etc. under a prefix).

Modifying our class gives us this:

```python
from typing import ClassVar, Dict, Type

class Serializable:
    _classes: ClassVar[Dict[int, Type['Serializable']]] = dict()

    def __init_subclass__(cls, id: int):
        if id in Serializable._classes:
            raise Exception(f"Class id \"{id}\" already used by \"{Serializable._classes[id].__name__}\"")
        Serializable._classes[id] = cls

        cls._class_id = id
        ...snip...
```

The `id` keyword argument added to `__init_subclass__` now makes it a requirement to pass an id when extending `Serializable`, like this:

```python
class Sample(Serializable, id=0x00)
    ...
```

It is good to remember that while this makes the registration of serializable classes automatic, they still need to be imported somewhere for this to work. It might sound obvious said like this, but it is entirely possible that a client or server make use of some properties or methods of a deserialized object without ever using the class directly. It's a good idea to import all serializable classes in a module and import that module when initializing the application.

With the class registry in place we can now start including the id in the payload and use it back when deserializing.

```python {hl_lines=["1","6-11","20"]}
@staticmethod
def deserialize(data: bytes) -> Optional['Serializable']:
    with BytesIO(data) as buffer:
        unpacker = msgpack.Unpacker(buffer, raw=False)

        class_id = unpacker.unpack()
        cls = Serializable._classes.get(class_id)
        if not cls:
            return None

        instance = cls()
        for field in cls._fields:
            setattr(instance, field, unpacker.unpack())

        return instance

def serialize(self) -> bytes:
    packer = msgpack.Packer(autoreset=False)

    packer.pack(self._class_id)

    for field in self.__class__._fields:
        packer.pack(getattr(self, field))

    return packer.bytes()
```

Note here that besides the additional code, `@classmethod` was changed to `@staticmethod` since we don't require the class argument anymore to create a new instance, we get the class from the registry. WIth those simple changes it is now possible to deserialize data without knowing the class in advance:

```python
data = Sample().serialize()
restored = Serializable.deserialize(data)
print(isinstance(restored, Sample)) # True
```

##### Reworking the constructor

Something that might not seem evident in the simplified examples so far is that our deserialization method messes up with our habits with the constructor. Because the class is instantiated first and then values are set from the payload, we can't initialize the instance using those values.

```python
class Sample(Serializable, id=0x00):
    fields = ["foo"]

    def __init__(self, foo:str = None):
        self.foo = foo
        print(self.foo) # placeholder for anything depending on `self.foo` being set

sample = Sample("Hello World!") # "Hello World!"
data = sample.serialize()
restored = Serializable.deserialize(data) # None
print(restored.foo) # "Hello World!"
```

Here another side effect of how we construct the class instance is that we _have_ to make all arguments optional since the deserializer doesn't pass anything to the constructor. We could come up with a way to pass all the values to the constructor but we couldn't possibly know, in the deserializer, what arguments to pass. Besides, we don't want to prevent developers from using the classes normally in order to work with the serializer.

Fortunately, Python is full of useful tricks that we can use to accomplish what we want with minimal impact to the end user. We keep all the complexity encapsulated in the `Serializable` class and expose the least amount of it possible. In Python we can create an instance of a class by calling [\_\_new\_\_](https://docs.python.org/3/reference/datamodel.html#object.__new__) on the class. It will create an instance but will not call `__init__` on the new instance.

```python {hl_lines=["11"]}
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
            setattr(instance, field, unpacker.unpack())

        return instance
```

That only gets us a third of the way there though. Because, now, anything that we were relying on from the constructor doesn't get called at all. We can introduce a new convention for this, we can decide that `__init__` is only for setting instance variables from manually constructed classes and introduce an `initialize()` method that can be used to implement initialization logic that depends on those values. The deserializer can call that method once everything is set.

```python {hl_lines=["15"]}
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
            setattr(instance, field, unpacker.unpack())

        instance.initialize()

        return instance
```

We're now two thirds of the way there. We fixed the deserialization, but creating an instance manually won't call the new `initialize()` method. Again, it shouldn't be the end user's responsibility to call this manually.

As always, there's a way to make this possible, and now it involves using [metaclasses](https://docs.python.org/3/reference/datamodel.html#metaclasses). Metaclasses are to classes what classes are to instances, if that makes sense. If a class has a metaclass, it will be used to "construct" the class. We can implement a simple metaclass that leverages [`__call__`](https://docs.python.org/3/reference/datamodel.html#emulating-callable-objects) to "intercept" instance creation calls and add our own logic to it that will call `initialize()` automatically for us.

```python {hl_lines=["1-5","8","11-13"]}
class SerializableMeta(type):
    def __call__(cls, *args, **kwargs):
        obj = type.__call__(cls, *args, **kwargs)
        obj.initialize()
        return obj


class Serializable(metaclass=SerializableMeta):
    ...

    def initialize(self):
        """Placeholder, should be overridden if necessary"""
        pass

    ...
```

##### Adding custom serializers

There's yet another detail we're missing. As-is, we can serialize pretty much anything but not other class instances. If we want to serialize other classes, they will first need to be serializable themselves and we'll need to register custom serializers and use them with `msgpack`.

To accomplish that we can use what `msgpack` call extended types. At serialization, when creating the `Packer` instance, we can pass a `default` argument to the constructor. This function will be called with a value when `msgpack` can't serialize it. It gives us the change to decide how to serialize the data and return `bytes` identified by an `int` code, wrapped in an `ExtType`.

But before that, let's add a way to register custom serializers. We don't want to bloat the serialization method with a bunch of different ways to serialize data. We can't predict _all_ the possible data type a user might want to serialize so it's better to allow them to implement their own and register them.

Here's the base class to extend to create a custom serializer:

```python
from abc import ABCMeta, abstractmethod
from typing import Generic, TypeVar, Optional, Any


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
```

And this is our custom serializer allowing `msgpack` to work with `Serializable` classes:

```python
class SerializableSerializer(CustomSerializer[Serializable], code=0x00):

    def serialize(self, obj: Serializable) -> Optional[bytes]:
        if not isinstance(obj, Serializable):
            return None
        return obj.serialize()

    def deserialize(self, data: bytes) -> Optional[Serializable]:
        return Serializable.deserialize(data)
```

Just like with serializable classe, it is important to reference custom serializers somewhere by importing them in order to have them auto-register.

Before getting into how to use the custom serializers we'll first add the`add_custom_serializer` method to the `Serializable` class.

```python
class Serializable(metaclass=SerializableMeta):

    ...snip...

    _serializers: ClassVar[Dict[int, CustomSerializer]] = dict()

    @classmethod
    def add_custom_serializer(cls, code: int, serializer: CustomSerializer) -> None:
        if code in cls._serializers:
            raise Exception(f"Serializer code {code} already in use")
        cls._serializers[code] = serializer

    ...snip...
```

These are the modifications to the `serialize` method. From here we can see how the `default` function works. Since we can't know what the criteria for a custom serializer might be, we loop over each one registered and call it. If it returns a value, we use it, and if it returns `None` then we skip and try the next one. It's setup to raise an exception if a value that is expected to be serialized doesn't have a custom serializer. It allow catching mistakes while developing rather than learn later that some value was never serialized.

```python {hl_lines=["2-9"]}
def serialize(self) -> bytes:
    def default(obj: Any) -> msgpack.ExtType:
        for code, serializer in self._serializers.items():
            data = serializer.serialize(obj)
            if data:
                return msgpack.ExtType(code, data)
        raise TypeError(f"Unknown type encountered: {obj}")

    packer = msgpack.Packer(default=default, autoreset=False)

    ...snip...
```

The `deserialize` method now looks like this, with the added `ext_hook` method:

```python {hl_lines=["1-5","7","10-11"]}
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
    ...snip...
```

## Known Issues

### Versioning

Meh

### Recursive object

JUST DON'T DO IT

### Complete Class

{{< sourcefile "serializable.py" >}}
