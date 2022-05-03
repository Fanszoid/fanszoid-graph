# Fanszoid tickets graph

Fanszoid's Marketplace and Tickets Graph, currently on Mumbai testnet:

https://thegraph.com/hosted-service/subgraph/fanszoid/fanszoid-tickets-mumbai (QmeuK8R9kdKoQyrSpnhUqSxS5GyeT7nS5vDRmUvz1meCZv)

## Deploy
1. Auth: `graph auth --product hosted-service KEY`
2. Build: `npm run codegen` && `npm run build-data` 
3. Deploy: `npm run deploy:[matic|mumbai]`

## Queries
Please refer to https://thegraph.com/docs/en/developer/graphql-api/

- Dev: `https://api.thegraph.com/subgraphs/name/fanszoid/fanszoid-tickets-mumbai`
- Prod: `https://api.thegraph.com/subgraphs/name/fanszoid/fanszoid-tickets-matic`

#### Get first 5 events, their tickets and the organizers

```typescript
{
  events(first: 5) {
    id
    ticketTypes {
      id
    }
    organizer {
      id
    }
  }
}
```

#### Get tickets that a user owns

```typescript
{
    tickets(where:{owner: $owner_address}) {
        id
        amount
    }
}
```

#### Get tickets that a user owns from a subset of ticket Types

```typescript
{
    tickets(where:{owner: $owner_address, ticketType_in: $ticketTypes}) {
        id
        amount
    }
}
```
