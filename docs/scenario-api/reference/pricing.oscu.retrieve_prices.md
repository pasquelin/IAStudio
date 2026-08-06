## Retrieve Prices

`client.pricing.oscu.retrievePrices(RequestOptionsoptions?): OscuRetrievePricesResponse`

**get** `/oscu/prices`

Get the public Prepaid Compute Units (or OSCU for One Shot Compute Units) price details

### Returns

- `OscuRetrievePricesResponse`

  - `prices: Array<Price>`

    - `creativeUnits?: number`

    - `currency?: string`

    - `expires?: number`

    - `unitAmount?: number`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.pricing.oscu.retrievePrices();

console.log(response.prices);
```

#### Response

```json
{
  "prices": [
    {
      "creativeUnits": 0,
      "currency": "currency",
      "expires": 0,
      "unitAmount": 0
    }
  ]
}
```
