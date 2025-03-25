import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load the data from hash_results.json
with open("hash_results.json", "r") as file:
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
#process_and_print_groups(contract_groups["tokenValidatorGroups"], "TokenValidator")

# Convert to a DataFrame
df = pd.DataFrame(data)

# Extract numeric values from prefixes for proper sorting
df['ozTokenAPrefix'] = (
    df['ozTokenAPrefix']
    .str.extract(r'(\d+)$')  # Extract numeric part of tokenPrefix
    .fillna(-1)              # Fill missing values with -1 or another placeholder
    .astype(int)             # Convert to integers
)

# Remove rows where prefixes couldn't be parsed (optional)
df = df[df['ozTokenAPrefix'] != -1]

#print(df.to_string())

# Apply the grouping logic to the DataFrame
df = map_to_groups(df, contract_groups["ozTokenAGroups"], "ozTokenA")
df.drop(columns=['ozTokenAPrefix'], inplace=True)
df.drop_duplicates(inplace=True)

# Convert gas usage columns to integers
for col in ["gasUsedOptimizedNoMeta", "gasUsedUnoptimizedNoMeta", "gasUsedOptimizedMeta", "gasUsedUnoptimizedMeta"]:
    df[col] = df[col].astype(int)

# Calculate the stacked values
df["Meta"] = df["gasUsedOptimizedMeta"]
df["UnoptimizedMeta"] = df["gasUsedUnoptimizedMeta"] - df["gasUsedOptimizedMeta"]
df["OptimizedNoMeta"] = df["gasUsedOptimizedNoMeta"] - df["gasUsedUnoptimizedMeta"]
df["UnoptimizedNoMeta"] = df["gasUsedUnoptimizedNoMeta"] - df["gasUsedOptimizedNoMeta"]

# Sort the DataFrame by the group column
df.sort_values(by="ozTokenAGroup", inplace=True)

# Plot the stacked bar chart
plt.figure(figsize=(12, 8))
bar_width = 0.4

# Stacked bar components
plt.bar(
    df["ozTokenAGroup"], df["Meta"], label="Optimized Hashvalidator", width=bar_width
)
plt.bar(
    df["ozTokenAGroup"], df["UnoptimizedMeta"], bottom=df["Meta"], label="Unoptimized Hashvalidator", width=bar_width
)
plt.bar(
    df["ozTokenAGroup"], df["OptimizedNoMeta"], bottom=df["Meta"] + df["UnoptimizedMeta"], label="Optimized Meta Data Excluding Hashvalidator", width=bar_width
)
plt.bar(
    df["ozTokenAGroup"], df["UnoptimizedNoMeta"], bottom=df["Meta"] + df["UnoptimizedMeta"] + df["OptimizedNoMeta"], label="Unoptimized Meta Data Excluding Hashvalidator", width=bar_width
)

# Set custom y-axis limits
plt.ylim(24000, 28000)

# Add horizontal lines
help_lines = [24500, 25000, 25500, 26000, 26500, 27000, 27500]
for line in help_lines:
    plt.axhline(y=line, color='gray', linestyle='--', linewidth=0.8)


# Add labels and legend
plt.title("Gas Usage Breakdown by Optimization Level", fontsize=16)
plt.xlabel("ozTokenGroup", fontsize=12)
plt.ylabel("Gas Used", fontsize=12)
plt.xticks(rotation=45, ha="right")
plt.legend(title="Gas Usage Components", fontsize=10)
plt.tight_layout()

# Save the plot as a PDF
plt.savefig("barchart_hash.pdf", format="pdf")
plt.show()

print(df.to_string())   