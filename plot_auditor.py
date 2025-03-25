import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np


# Load the data from JSON
with open('validation_gas_results.json', 'r') as file:
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


# Function to print groups with labels and optimization ranges
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
process_and_print_groups(contract_groups["tokenGroups"], "Token")
process_and_print_groups(contract_groups["auditCheckGroups"], "AuditCheck")

# Convert data into a DataFrame
df = pd.DataFrame(data)

# Extract numeric values from prefixes for proper sorting
df['tokenPrefix'] = (
    df['tokenPrefix']
    .str.extract(r'(\d+)$')  # Extract numeric part of tokenPrefix
    .fillna(-1)              # Fill missing values with -1 or another placeholder
    .astype(int)             # Convert to integers
)
df['auditCheckPrefix'] = (
    df['auditCheckPrefix']
    .str.extract(r'(\d+)$')  # Extract numeric part of auditCheckPrefix
    .fillna(-1)              # Fill missing values with -1 or another placeholder
    .astype(int)             # Convert to integers
)

# Remove rows where prefixes couldn't be parsed (optional)
df = df[df['tokenPrefix'] != -1]
df = df[df['auditCheckPrefix'] != -1]

#print(df.to_string())

# Apply the grouping logic to the DataFrame
df = map_to_groups(df, contract_groups["auditCheckGroups"], "auditCheck")
df = map_to_groups(df, contract_groups["tokenGroups"], "token")

# Aggregate gas usage by groups
#grouped_data = df.groupby(['tokenPrefix', 'auditCheckGroup']).agg({'gasUsed': 'mean'}).reset_index()

# Pivot the DataFrame to create a matrix suitable for a heatmap
# heatmap_data = df.pivot(index='tokenPrefix', columns='auditCheckPrefix', values='gasUsed')
df.drop(columns=['auditCheckPrefix'], inplace=True)
df.drop(columns=['tokenPrefix'], inplace=True)
df.drop_duplicates(inplace=True)

heatmap_data = df.pivot(index='tokenGroup', columns='auditCheckGroup', values='gasUsed')

# Convert gasUsed to numeric for proper plotting
heatmap_data = heatmap_data.apply(pd.to_numeric, errors='coerce')

# Sort the indices and columns numerically
heatmap_data = heatmap_data.sort_index(axis=0).sort_index(axis=1)

# Create concise labels
#def format_labels(index):
#    return [f"2^{int(np.log2(val + 1))} - 1" if val >= 0 else "None" for val in index]

# Update the labels for the heatmap axes
#heatmap_data.columns = format_labels(heatmap_data.columns)
#heatmap_data.index = format_labels(heatmap_data.index)

# Sort the index and columns in ascending order
heatmap_data = heatmap_data.sort_index(ascending=False, axis=0)  # TokenGroups (rows)
heatmap_data = heatmap_data.sort_index(ascending=True, axis=1)  # AuditCheckGroups (columns)

print(heatmap_data.to_string())

# Plot the heatmap
plt.figure(figsize=(12, 8))
sns.heatmap(
    heatmap_data,
    annot=False,  # Disable text annotations inside cells
    cmap="viridis",
    cbar_kws={"label": "Gas Used"},
    linewidths=0.5,
    linecolor='gray'
)
plt.title("Validation Gas Consumption Heatmap", fontsize=16)
plt.xlabel("AuditCheck Optimization Level", fontsize=12)
plt.ylabel("Token Optimization Level", fontsize=12)
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig("validation_gas_heatmap.pdf", format="pdf")
plt.show()
