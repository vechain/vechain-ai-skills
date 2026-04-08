# Data Modeling: Monetary and Large-Number Fields

## BigDecimal with DECIMAL128 — the Richlist Pattern

When indexing fields that represent token amounts, stakes, balances, or any large integer values from smart contract events, follow the **richlist pattern**: store as `BigDecimal` with MongoDB's `DECIMAL128` for precision and querying, expose as `BigInteger` in JSON responses for correct serialization.

### Why this split?

- **MongoDB side (`BigDecimal` + `DECIMAL128`)**: Native numeric type enables aggregation queries (`$sum`, `$avg`, comparison operators). No precision loss for values up to 34 significant digits.
- **JSON side (`BigInteger`)**: The existing `JacksonConfig` serializes `BigInteger` as quoted strings via `ToStringSerializer`, preventing scientific notation (`1e+21`) and JavaScript number overflow. `BigDecimal` does NOT have this serializer — returning `BigDecimal` directly produces scientific notation for large values.

### Model pattern

Use `@JsonIgnore` on the `BigDecimal` storage field and expose a `BigInteger` getter via `@JsonProperty`:

```kotlin
import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import java.math.BigDecimal
import java.math.BigInteger
import org.springframework.data.mongodb.core.mapping.Field
import org.springframework.data.mongodb.core.mapping.FieldType

@Document(collection = "my_collection")
data class MyEntity(
    // Storage field — BigDecimal for MongoDB DECIMAL128
    @JsonIgnore @Field(targetType = FieldType.DECIMAL128) val stake: BigDecimal,
) : VersionedDocument {

    // JSON field — BigInteger for safe serialization as quoted string
    @get:JsonProperty("stake")
    val stakeValue: BigInteger
        get() = stake.toBigInteger()
}
```

### Real-world example — B3TR Richlist

`B3trBalance` stores balances as `BigDecimal`/`DECIMAL128`. The richlist service converts to `BigInteger` when building the response DTO:

```kotlin
// Model (BigDecimal for storage)
@Field(targetType = FieldType.DECIMAL128) var totalBalance: BigDecimal

// Response DTO (BigInteger for JSON)
data class B3trRichlistItem(val address: String, val balance: BigInteger, val rank: Long)

// Service converts
B3trRichlistItem(
    address = doc.address,
    balance = balanceForScope(doc, scope).toBigIntegerExact(),
    rank = startRank + index,
)
```

### Service pattern — parsing event params

Event parameters arrive as strings. Parse to `BigDecimal` with null-safe fallback:

```kotlin
private fun String?.toBigDecimalOrZero(): BigDecimal =
    this?.toBigDecimalOrNull() ?: BigDecimal.ZERO

// Usage
val stake = ev.params.getAsString("stakeAmount").toBigDecimalOrZero()
```

### Service pattern — arithmetic

Use `BigDecimal` operators (Kotlin overloads `+`, `-`, comparison):

```kotlin
val newTotal = nav.totalDelegated + amount
val remaining = maxOf(BigDecimal.ZERO, nav.stake - slashAmount)
```

### Overview/aggregate endpoints

For aggregate DTOs, use `BigInteger` directly and let `JacksonConfig` handle serialization:

```kotlin
data class NavigatorOverview(
    val totalStaked: BigInteger,   // serialized as "125000" (quoted string)
    val totalDelegated: BigInteger,
)

// In service — aggregate BigDecimal, convert at the end
var totalStaked = BigDecimal.ZERO
for (nav in navigators) { totalStaked += nav.stake }
return NavigatorOverview(totalStaked = totalStaked.toBigInteger(), ...)
```

### Common mistakes

1. **Returning `BigDecimal` directly in JSON** → produces `1e+21` for large values (no global `ToStringSerializer`)
2. **Using `String` instead of `DECIMAL128`** → MongoDB can't run numeric queries or aggregations
3. **Using `BigDecimal.toString()`** → can produce scientific notation; use `toBigInteger()` for response fields
