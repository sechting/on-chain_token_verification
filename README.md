# On-Chain Token Validation: A Feasability Study
This is the code for evaluating three distinct on-chain token verification methods. Follow along to replay the results and find mistakes. Pardon my french with naming things. This paper has been accepted at ICBC'25


## Evaluate the TokenValidator contract

1. run the `compile_variants.js` script, this should store all the compiled variants of the contracts in the directory `evaluation`.

```node compile_variants.js```

2. run the `test_from_evaluation_v6/js` script, this will create the evaluation_results.json in the root directory.

```npx hardhat run script/test_from_evaluation_v6.js```

3. plot the data using `plot_tokenvalidator.py`. If there are many identical values the plotter should remove too many duplicates to squeeze the results a little.

```python3 plot_tokenvalidator.py```

## Evaluate the hash creation

1. run the `compile_variants.js` script. This can be skipped if already done from previous testing.

2. run the `test_hash.js` script

```npx hardhat run scripts/test_hash.js```

3. plot the data using `plot_hash.py`

```python3 plot_hash.py```

## Evaluate the certificate check

1. run the `compile_variants.js` script. This can be skipped if already done from previous testing.

2. run the `test_auditor.js` script

```npx hardhat run scripts/test_auditor.js```

3. run the `grouping_audit.js` script

```npx hardhat run scripts/grouping_audit.js```

4. plot the data using `plot_auditor.py`

```python3 plot_auditor.py```
