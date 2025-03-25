import json
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter
import pandas as pd

# Add commas to Y-axis labels
def add_commas(value, tick_number):
    return f'{int(value):,}'

# Load data from evaluation_results.json
with open("evaluation_results.json", "r") as file:
    data = json.load(file)

    # Load the contract groups
with open('contract_groups.json', 'r') as file:
    contract_groups = json.load(file)

# Function to extract numeric values from prefixes
def extract_numeric(prefix):
    # Remove "none" prefix and convert the remaining part to an integer
    if prefix.startswith("none"):
        return int(prefix.replace("none", ""))
    else:
        raise ValueError(f"Unexpected prefix format: {prefix}")

def process_and_print_groups(groups, label):
    print(f"--- {label.upper()} GROUPS ---")
    group_data = {}  # Dictionary to store processed groups
    group_number = 1
    for group in groups:
        if "nonenone" in group["contracts"]:
            continue  # Skip the group containing "nonenone"

        # Extract numeric values for all prefixes in the group
        numeric_values = [
            extract_numeric(contract) for contract in group["contracts"]
        ]
        numeric_values.sort()  # Sort numeric values to find range
        # Determine the lowest and highest optimization levels
        lowest = f"{numeric_values[0]}"
        highest = f"{numeric_values[-1]}"

        # Print the group information
        print(f"Group {group_number}: Range {lowest} to {highest}")

        # Store the group in the dictionary
        group_data[f"Group {group_number}"] = {
            "contracts": group["contracts"],
            "range": (lowest, highest),
            "numeric_values": numeric_values,
        }

        group_number += 1

    return group_data

def map_to_groups(df, group_data, target_group):
    # Filter out the group containing "nonenone"
    filtered_groups = [
        group for group in group_data
        if "nonenone" not in group["contracts"]
    ]
    # Sort auditcheck_groups by the minimum numeric value in their contracts
    sorted_groups = sorted(
        filtered_groups,
        key=lambda group: min(
            int(contract.replace("none", ""))
            for contract in group["contracts"]
            if contract.startswith("none")
        )
    )
    group_mapping = {}
    # Iterate over the list of groups and create a mapping
    for idx, group in enumerate(sorted_groups):
        group_name = f"Group {idx}"  # Generate group name
        for contract in group["contracts"]:
            numeric_value = extract_numeric(contract)  # Extract numeric value from prefix
            group_mapping[numeric_value] = group_name

    # Map the auditCheckPrefix to auditCheckGroup
    df[f"{target_group}Group"] = df[f"{target_group}Prefix"].map(
        lambda prefix: group_mapping.get(prefix, "Unknown")
    )
    # Map numeric values to group names in the DataFrame
    df[f"{target_group}Group"] = df[f"{target_group}Prefix"].map(group_mapping)

    return df

# Process and print token and auditCheck groups
process_and_print_groups(contract_groups["ozTokenAGroups"], "Token")

# Convert to a DataFrame
df = pd.DataFrame(data)

# Extract numeric values from prefixes for proper sorting
df['ozTokenAPrefix'] = (
    df['ozTokenAPrefix']
    .str.extract(r'(\d+)$')  # Extract numeric part of tokenPrefix
    .fillna(-1)              # Fill missing values with -1 or another placeholder
    .astype(int)             # Convert to integers
)

# Apply the grouping logic to the DataFrame
df = map_to_groups(df, contract_groups["ozTokenAGroups"], "ozTokenA")
df.drop(columns=['ozTokenAPrefix'], inplace=True)
df.drop_duplicates(inplace=True)
df['ozTokenAGroup'].fillna('none', inplace=True)

df = df.loc[df.groupby(['ozTokenAGroup'])['deploymentCostToken'].idxmin()]

df['gasUsedUnoptimized'] = pd.to_numeric(df['gasUsedUnoptimized'], errors='coerce').astype('Int64')
df['gasUsedOptimized'] = pd.to_numeric(df['gasUsedOptimized'], errors='coerce').astype('Int64')
df["deploymentCostToken"] = pd.to_numeric(df["deploymentCostToken"], errors='coerce').astype('Int64')

df["gasUnOptimized"] = df["gasUsedUnoptimized"] - df["gasUsedOptimized"]

# Sort the DataFrame with "none" first, then Group 0 to Group 5
sort_order = ["none"] + [contract_groups.get(f"Group {i}", f"Group {i}") for i in range(6)]
df["ozTokenAGroup"] = pd.Categorical(df["ozTokenAGroup"], categories=sort_order, ordered=True)
df = df.sort_values("ozTokenAGroup")

print(df.to_string())

# Plot
bar_width = 0.4  # Keep bars narrow to avoid overlap

# Stacked bar components
plt.bar(
    df["ozTokenAGroup"], df["gasUsedOptimized"], label="Optimized Validator (Runtime Cost)", width=bar_width
)
plt.bar(
    df["ozTokenAGroup"], df["gasUnOptimized"], bottom=df["gasUsedOptimized"], label="Unoptimized Validator (Excess Cost)", width=bar_width
)
plt.plot(
    df["ozTokenAGroup"], 
    df["deploymentCostToken"], 
    color="black", 
    marker="o", 
    linestyle="--", 
    label="Deployment Cost Token"
)

# Format the table correctly
plt.ticklabel_format(style='plain', axis='y')
# Adjust Y-axis
lowest_tick = 300000  # Hardcoded value, since values are always above 300k
highest_tick = 1100000  # Hardcoded value, since values are always below 1,1M
plt.ylim(lowest_tick * 0.9, highest_tick)
plt.yticks(np.arange(lowest_tick, highest_tick, 100000))
# Get the current Axes object
ax = plt.gca()
# Set the major formatter for the y-axis
ax.yaxis.set_major_formatter(FuncFormatter(add_commas))
# Add horizontal lines
help_lines = [300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000]
for line in help_lines:
    plt.axhline(y=line, color='gray', linestyle='--', linewidth=0.8)

# Add labels and legend
plt.title("Gas Usage Breakdown by Optimization Level", fontsize=16)
plt.xlabel("Optimization Level of Token", fontsize=12)
plt.ylabel("Gas Used", fontsize=12)
plt.xticks(rotation=45, ha="right")
plt.legend(title="Gas Usage Components", fontsize=10)
plt.tight_layout()

# Save the plot as a PDF
plt.savefig("barchart_static_analysis.pdf", format="pdf")
plt.show()

exit()

#print(data)
# Extract relevant information and remove "ipfs" from prefixes
#prefixes = [entry["ozTokenAPrefix"].replace("ipfs", "") for entry in data]
#gas_optimized = [int(entry["gasUsedOptimized"]) for entry in data]
#gas_unoptimized = [int(entry["gasUsedUnoptimized"]) for entry in data]
#deployment_costs = [int(entry["deploymentCostToken"]) for entry in data]

# Simplify data by grouping identical values and keeping only first and last in each group
#filtered_prefixes = []
#filtered_gas_optimized = []
#filtered_gas_unoptimized = []
#filtered_deployment_costs = []

#for i, prefix in enumerate(prefixes):
#    if i == 0 or gas_optimized[i] != gas_optimized[i - 1] or gas_unoptimized[i] != gas_unoptimized[i - 1] or deployment_costs[i] != deployment_costs[i - 1]:
#        filtered_prefixes.append(prefix)
#        filtered_gas_optimized.append(gas_optimized[i])
#        filtered_gas_unoptimized.append(gas_unoptimized[i])
#        filtered_deployment_costs.append(deployment_costs[i])

#if filtered_prefixes[-1] != prefixes[-1]:
#    filtered_prefixes.append(prefixes[-1])
#    filtered_gas_optimized.append(gas_optimized[-1])
#    filtered_gas_unoptimized.append(gas_unoptimized[-1])
#    filtered_deployment_costs.append(deployment_costs[-1])

#filtered_prefixes[-1] = "max"

# Calculate excess cost for unoptimized TokenValidator
#excess_cost_unoptimized = [unopt - opt for unopt, opt in zip(filtered_gas_unoptimized, filtered_gas_optimized)]

# Plot
#x = np.arange(len(filtered_prefixes)) * 0.5  # Scale down gaps between bars
#width = 0.2  # Keep bars narrow to avoid overlap

fig, ax = plt.subplots(figsize=(12, 6))
ax.bar(x, filtered_gas_optimized, width, label="Optimized Validator (Runtime Cost)")
ax.bar(x, excess_cost_unoptimized, width, bottom=filtered_gas_optimized, label="Unoptimized Validator (Excess Cost)")
ax.plot(x, filtered_deployment_costs, color="black", marker="o", linestyle="--", label="Deployment Cost Token")

ax.set_xlabel("Optimization Level of Token")
ax.set_ylabel("Gas Units spend")
ax.set_title("Gas Usage vs Optimization Level")
ax.set_xticks(x)
ax.set_xticklabels(filtered_prefixes, rotation=45, ha="right")
ax.ticklabel_format(style='plain', axis='y')
ax.yaxis.set_major_formatter(FuncFormatter(add_commas))
ax.legend()
ax.grid(axis="y", linestyle="--", alpha=0.7)

# Dynamically adjust Y-axis
all_gas_values = filtered_gas_optimized + [opt + exc for opt, exc in zip(filtered_gas_optimized, excess_cost_unoptimized)] + filtered_deployment_costs
y_min, y_max = min(all_gas_values), max(all_gas_values)
lowest_tick = 300000  # Hardcoded value, since values are always above 300k
ax.set_ylim(lowest_tick * 0.9, y_max * 1.1)
ax.set_yticks(np.arange(lowest_tick, y_max, 100000))

plt.tight_layout()
plt.savefig("barchart_static_analysis.pdf", format="pdf")

plt.show()
