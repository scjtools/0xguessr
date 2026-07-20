SELECT address
FROM `bigquery-public-data.crypto_ethereum.balances`
WHERE eth_balance >= 1000000000000000000
