# ClickUp Integration Directory

This directory contains files related to our ClickUp project management integration.

## Directory Structure

### `/exports`
Contains files exported from ClickUp for reference:
- `tasks-export.yml`: Raw task export from ClickUp
- `clickup-list.yml`: Current ClickUp list configurations
- `clickup-statuses.yml`: Current status configurations
- `clickup-config.yml`: Current ClickUp configurations

### `/imports`
Contains files pending import into ClickUp:
- `tasks-organized.yml`: Reformatted tasks ready for import
- `admin-features.yml`: Admin features to be created as tasks
- `feature-ideas.yml`: Product features to be created as tasks
- `brevo-templates-task.yml`: Email template tasks to be created
- `additional-tasks.yml`: Additional tasks to be imported

## Usage

1. `/exports` directory contains the current state of our ClickUp workspace
2. `/imports` directory contains new tasks and configurations ready to be imported
3. After successful import, move files from `/imports` to `/exports` to maintain history
