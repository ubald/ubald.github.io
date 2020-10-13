---
title: Python Classes Serialization
slug: serialization
categories:
    - networking
tags:
    - serialization
    - python
    - msgpack
date: 2020-10-11T00:00:00.000Z
draft: true
---

The first step to tackle before diving into the networking library is the data serialization. It is specific enough to be developed in isolation and will come in handy when the time comes to send and receive test data later in the library development.

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
            unpacker = msgpack.Unpacker(buffer)
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
    fields = []

    @classmethod
    def deserialize(cls, data: bytes) -> 'Serializable':
        with BytesIO(data) as buffer:
            unpacker = msgpack.Unpacker(buffer)
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

From this point, we can look at how to improve this early prototype of a serializable class and make it into something more flexible. For starters, this won't let us extend from a serializable class and add fields to it because `fields` ends up being overwritten by the new subclass. In order to do this we need to be able to traverse the class hierarchy and accumulate fields that are defined at each level.

```python
@property
def fields(self) -> List[str]:
    # https://stackoverflow.com/questions/480214/how-do-you-remove-duplicates-from-a-list-in-whilst-preserving-order/39835527#39835527
    return list(OrderedDict.fromkeys([
        field for fields in [
            cast(Type[Serializable], c)._fields for c in reversed(self.__class__.mro()) if hasattr(c, '_fields') and cast(Type[Serializable], c)._fields is not None
            c._fields for c in reversed(self.__class__.mro()) if hasattr(c, '_fields') and c._fields is not None
        ] for field in fields
    ]))
```

### Bonus flexibility

Custom serialization and custom serializers.

## Class structure

## Known Issues

### Versioning

Meh

### Recursive object

JUST DON'T DO IT
