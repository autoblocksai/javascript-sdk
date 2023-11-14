import fs from 'fs/promises';
import type { PromptTracking } from '../util';

// This type will be autogenerated later by the user via a CLI command
// provided by this package.
interface TemplatePathToParameters {}

// The name of the interface above that we autogenerate.
const AUTOGENERATED_INTERFACE_NAME = 'TemplatePathToParameters';

// This is what the interface looks like when it's empty,
// i.e. before the user has run the autogeneration script
// and before the comments have been added.
const AUTOGENERATED_INTERFACE_EMPTY = `interface ${AUTOGENERATED_INTERFACE_NAME} {\n}`;

// These will be added by our autogeneration script before
// and after the autogenerated interface so that we can find
// the start and end indexes of the interface in the file.
const AUTOGENERATED_INTERFACE_COMMENT_START =
  '// template-path-to-parameters-start';
const AUTOGENERATED_INTERFACE_COMMENT_END =
  '// template-path-to-parameters-end';

// After building this file, there will be a file next to
// the index.js file called index.d.ts. This is the file
// that will be used by TypeScript to provide type checking,
// so it's where we write the autogenerated interface.
const TYPES_DECLARATION_FILENAME = 'index.d.ts';

// If the user doesn't specify a templates directory in their
// package.json, we'll assume the templates are in this directory,
// relative to the nearest package.json file (that isn't ours)
// or the nearest directory that contains a node_modules directory.
const DEFAULT_TEMPLATES_DIRECTORY = 'autoblocks-templates';

// The directory this package will be in once someone installs it.
// We use this to make sure we continue moving up the directory
// tree when looking for the nearest package.json or node_modules
// directory.
const THIS_PACKAGE_NAME = 'node_modules/@autoblocks/client';

export class PromptTemplateManager {
  private initialized: boolean = false;
  private templates: Record<string, string> = {};
  private templatePlaceholders: Record<string, string[]> = {};

  // We keep track of the builders in test environments so we can access their snapshots
  private builders: Record<string, PromptBuilder> = {};

  private async findNearestDirectoryContaining(
    filename: string,
  ): Promise<string | undefined> {
    let currentDir = __dirname;

    while (currentDir !== '/') {
      if (!currentDir.includes(THIS_PACKAGE_NAME)) {
        const files = await fs.readdir(currentDir);
        if (files.includes(filename)) {
          return currentDir;
        }
      }

      currentDir = currentDir.slice(0, currentDir.lastIndexOf('/'));
    }

    return undefined;
  }

  /**
   * Find nearest package.json file that has an Autoblocks templates
   * directory field.
   */
  private async findTemplatesDirectoryFromNearestPackageJson(): Promise<
    string | undefined
  > {
    let currentDir = __dirname;

    while (currentDir !== '/') {
      if (!currentDir.includes(THIS_PACKAGE_NAME)) {
        const files = await fs.readdir(currentDir);

        if (files.includes('package.json')) {
          const content = await fs.readFile(
            `${currentDir}/package.json`,
            'utf-8',
          );
          const packageObj = JSON.parse(content);
          if (packageObj.autoblocks?.templatesDirectory) {
            const templatesDirectory = packageObj.autoblocks.templatesDirectory;
            if (templatesDirectory.startsWith('/')) {
              // Absolute path
              return templatesDirectory;
            } else if (templatesDirectory.startsWith('./')) {
              // Relative path
              return `${currentDir}/${templatesDirectory.slice(2)}`;
            } else {
              // Relative path
              return `${currentDir}/${templatesDirectory}`;
            }
          }
        }
      }

      currentDir = currentDir.slice(0, currentDir.lastIndexOf('/'));
    }

    return undefined;
  }

  private async findTemplatesDirectory(): Promise<string> {
    // First try to find a package.json that specifies a templates directory
    const templatesDirectoryFromPackageJson =
      await this.findTemplatesDirectoryFromNearestPackageJson();
    if (templatesDirectoryFromPackageJson) {
      return templatesDirectoryFromPackageJson;
    }

    // Otherwise find the nearest directory that contains a node_modules directory
    // and assume the templates are in autoblocks-templates/
    const nearestNodeModules =
      await this.findNearestDirectoryContaining('node_modules');
    if (nearestNodeModules) {
      return `${nearestNodeModules}/${DEFAULT_TEMPLATES_DIRECTORY}`;
    }

    // Otherwise find the nearest package.json and assume the templates are in
    // autoblocks-templates/
    const nearestPackageJson =
      await this.findNearestDirectoryContaining('package.json');
    return `${nearestPackageJson}/${DEFAULT_TEMPLATES_DIRECTORY}`;
  }

  /**
   * Walk the directory recursively and add all templates to the templates object.
   */
  private async walkDirectory(args: {
    directoryName: string;
    pathToTemplatesDirectory: string;
    buildingTypes: boolean;
  }): Promise<void> {
    const dirs = await fs.readdir(args.directoryName);

    await Promise.all(
      dirs.map(async (dir) => {
        const path = `${args.directoryName}/${dir}`;
        const stat = await fs.stat(path);
        if (stat.isDirectory()) {
          await this.walkDirectory({
            directoryName: path,
            pathToTemplatesDirectory: args.pathToTemplatesDirectory,
            buildingTypes: args.buildingTypes,
          });
        } else {
          // Get the path to the template relative to the templates/ directory and remove the
          // leading slash.
          const relativePath = path
            .replace(args.pathToTemplatesDirectory, '')
            .slice(1);

          const fileContent = await fs.readFile(path, 'utf-8');

          this.templates[relativePath] = fileContent;

          if (args.buildingTypes) {
            // Find all placeholder names in the template. They look like: ${placeholderName}
            const placeholders = fileContent.match(/\$\{[a-zA-Z0-9]+\}/g);

            // Get the placeholder names, e.g. placeholderName, by removing the ${} around them.
            const placeholderNames = (placeholders ?? []).map((placeholder) => {
              return placeholder.slice(2, -1);
            });

            console.log(`Found template ${relativePath}`);
            console.log(`  Placeholders: ${placeholderNames.join(', ')}`);

            this.templatePlaceholders[relativePath] = placeholderNames;
          }
        }
      }),
    );
  }

  /**
   * Generate the types for the templates and update the interface in index.d.ts.
   */
  private generateInterface() {
    let generated = AUTOGENERATED_INTERFACE_COMMENT_START + '\n';
    generated += `interface ${AUTOGENERATED_INTERFACE_NAME} {`;

    Object.entries(this.templatePlaceholders)
      .sort(([pathA], [pathB]) => (pathA < pathB ? -1 : 1))
      .forEach(([path, placeholders]) => {
        if (placeholders.length === 0) {
          generated += `\n  '${path}': Record<string, never>;`;
        } else {
          generated += `\n  '${path}': {`;
          placeholders.map((placeholder) => {
            generated += `\n    ${placeholder}: string;`;
          });
          generated += '\n  };';
        }
      });

    generated += `\n}${AUTOGENERATED_INTERFACE_COMMENT_END}\n`;

    return generated;
  }

  private determineStartAndEndIdx(content: string): {
    start: number;
    end: number;
  } {
    const firstTimeStartIdx = content.indexOf(AUTOGENERATED_INTERFACE_EMPTY);
    if (firstTimeStartIdx !== -1) {
      // The autogeneration CLI is being run for the first time,
      // so the start and end indexes are just the start and end
      // of the empty interface.
      return {
        start: firstTimeStartIdx,
        end: firstTimeStartIdx + AUTOGENERATED_INTERFACE_EMPTY.length,
      };
    } else {
      // The autogeneration CLI has been run before, so we can
      // find the start and end indexes by looking for the comments
      // we added to the file in a previous run.
      return {
        start: content.indexOf(AUTOGENERATED_INTERFACE_COMMENT_START),
        end:
          content.indexOf(AUTOGENERATED_INTERFACE_COMMENT_END) +
          AUTOGENERATED_INTERFACE_COMMENT_END.length,
      };
    }
  }

  private async generateTypes() {
    const content = await fs.readFile(
      `${__dirname}/${TYPES_DECLARATION_FILENAME}`,
      'utf-8',
    );

    const { start, end } = this.determineStartAndEndIdx(content);

    if (start !== -1 && end !== -1) {
      const generatedInterface = this.generateInterface();
      const newContent =
        content.slice(0, start) + generatedInterface + content.slice(end);
      await fs.writeFile(
        `${__dirname}/${TYPES_DECLARATION_FILENAME}`,
        newContent,
      );
    } else {
      console.error(
        `Couldn't find ${AUTOGENERATED_INTERFACE_NAME} in ${TYPES_DECLARATION_FILENAME}`,
      );
    }
  }

  async init(args?: { generateTypes?: boolean }): Promise<void> {
    if (this.initialized) {
      return;
    }

    const templatesDirectory = await this.findTemplatesDirectory();

    if (args?.generateTypes) {
      console.log(`Found templates directory: ${templatesDirectory}`);
      console.log('Generating types...');
    }

    await this.walkDirectory({
      directoryName: templatesDirectory,
      pathToTemplatesDirectory: templatesDirectory,
      buildingTypes: args?.generateTypes ?? false,
    });

    if (args?.generateTypes) {
      await this.generateTypes();
      console.log('Done generating types!');
    }

    this.initialized = true;
  }

  /**
   * Creates a new builder instance for composing prompt(s) to be sent to an LLM model.
   *
   * @param promptTrackingId The tracking ID for the prompt(s) being built by this builder. This should remain constant over time, as
   * it is used to track how the prompt(s) change over time. This identifier is used to identify the prompt(s) in the Autoblocks UI.
   * @returns TemplateBuilder
   */
  makeBuilder(promptTrackingId: string) {
    if (!this.initialized) {
      throw new Error('Template manager not initialized.');
    }

    const builder = new PromptBuilder({
      trackingId: promptTrackingId,
      templates: this.templates,
    });

    if (process.env.NODE_ENV === 'test') {
      this.builders[promptTrackingId] = builder;
    }

    return builder;
  }

  snapshots(promptTrackingId: string): string[] {
    const builder = this.builders[promptTrackingId];

    if (!builder) {
      return [];
    }

    // We assume snapshots are only accessed once.
    // This also allows users to make multiple snapshot
    // assertions for the same promptTrackingId over
    // many tests.
    delete this.builders[promptTrackingId];

    return builder.snapshots();
  }
}

export class PromptBuilder {
  private readonly trackingId: string;
  private readonly templates: Record<string, string>;

  // Keep track of which templates were used during the lifetime of the builder.
  private templatesUsed: Record<string, string>;

  // Keep track of the rendered templates for snapshot testing.
  private templatesRendered: string[];

  constructor(args: { trackingId: string; templates: Record<string, string> }) {
    this.trackingId = args.trackingId;
    this.templates = args.templates;
    this.templatesUsed = {};
    this.templatesRendered = [];
  }

  build<Path extends keyof TemplatePathToParameters>(
    path: Path,
    params: TemplatePathToParameters[Path],
  ): string {
    const template = this.templates[path];

    if (!template) {
      throw new Error(`No template found for path ${path}`);
    }

    let rendered = template;

    Object.entries(params).forEach(([key, value]) => {
      rendered = rendered.replace(`\${${key}}`, `${value}`);
    });

    // Record that the template was used
    this.templatesUsed[path] = template;

    // Record the rendered template in test environments
    if (process.env.NODE_ENV === 'test') {
      this.templatesRendered.push(rendered);
    }

    return rendered;
  }

  /**
   * Creates a prompt tracking object that will be sent along with Autoblocks events
   * to track which templates were used.
   */
  usage(): PromptTracking {
    const templates = Object.entries(this.templatesUsed).map(
      ([id, template]) => {
        return { id, template };
      },
    );

    return {
      id: this.trackingId,
      templates: templates,
    };
  }

  /**
   * Intended to be used with Jest snapshot testing.
   *
   * This will allow you to easily snapshot the rendered templates
   * so that your code reviews involve both the code changes and the
   * changes to the rendered templates.
   *
   * See https://jestjs.io/docs/snapshot-testing
   *
   * Example:
   *
   * const builder = promptManager.makeBuilder('my-tracking-id');
   *
   * const response = await openai.chat.completions.create({
   *   messages: [
   *     {
   *      role: 'system',
   *      content: builder.build('feature-a/system', {
   *        languageRequirement: builder.build('common/language', {
   *        language: 'Spanish',
   *      }),
   *     },
   *     {
   *      role: 'user',
   *      content: builder.build('feature-a/user', {
   *        name: 'Adam',
   *      }),
   *     },
   *   ],
   *   model: 'gpt-3.5-turbo',
   * });
   *
   * builder.snapshots().forEach((snapshot) => {
   *   expect(snapshot).toMatchSnapshot();
   * });
   */
  snapshots(): string[] {
    return this.templatesRendered;
  }
}
