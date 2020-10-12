---
title: Networking Library Requirements
slug: introduction
categories:
    - networking
date: 2020-10-11
draft: true
---

## Introduction

During my time working with the [Metalab](https://sat.qc.ca/recherche/metalab) team of the [Société des arts technologiques](https://sat.qc.ca) I had the chance to work on the _EiS_ research project. _EiS_, which stands for _Édition In Situ_, in French, is an in-situ immersive environment creation tool that allows immersive 3D scene editing from inside the immersive space using VR controllers. It was primarily developed to be used from inside the Société des arts technologiques' full dome. Using VR controllers, without a headset in this instance, since it's used in a projection-mapped environment, it is possible to create 3D scenes, animate objects with keyframes, attach spatialized audio to objects and more. It was necessary to be able to connect multiple immersive spaces together either on a local network or over the internet to allow for remote collaboration or presentation to a remote or distributed audience. While there is a lot of content that could be covered regarding _EiS_ the focus of this series will be on the networking library that was built to enable the collaborative editing aspect of the project.

This library is written in Python and is open-source, it's available on the [Metalab's Gitlab](https://gitlab.com/sat-metalab/py-satnet).

## Overview

The library was developed from the ground up to be reusable for any other project requiring the same kind of networked editing experience. It includes all the necessary abstractions for any part to be extended according to the project's requirements and different network adapters can be implemented to transport data in different ways.

### Library Requirements

Swappable network transport adapters
: During or after development, as a requirement of another project and as an option for external library users, it needed to allow for swapping the network transport layer. Whether because of technology availability or later optimization it was decided to make it easy to implement new means of transporting the data between the server and clients.

Simultaneous editing from multiple locations
: There needs to be a central state owned by the server, this is the source of truth for the whole system. Clients can join an editing session and leave it at will.

Ability to subscribe to a subset of data
: Not everything needs to be constantly streamed to the clients, there needs to be a way to subscribe to detailed topics on specific entities when needed.

Ability to undo actions without disrupting another user's session
: A contextualized action history allows for per-object undo/redo histories

Simplify daily use of the library as much as possible
: While an initial investment must be made to integrate the library in a project its day-to-day usage needed to be as simple as possible. All the complexity should be hidden when adding a new entity or implementing a new command or action. The developer implementing the new piece should have a simple recipe to follow and not have to worry about serialization, synchronization or anything more than the domain logic they are implementing.

#### Technical Requirements

Data Serialization
: Data needs to be serialized and deserialized when transported over the network. It should be made as simple as possible for the end-user of the library to decide which fields need to be serialized in their classes but custom serialization must also be possible for special cases.
