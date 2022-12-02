import Logger from './Logger';
import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    key: string;
    value: string;
}

export default class MetadataSetNode extends Node<Args> {
    static _instance: MetadataSetNode;
    static instance() {
        if (!MetadataSetNode._instance) {
            MetadataSetNode._instance = new MetadataSetNode();
            registerStaticNodeClass(MetadataSetNode);
        }
        return MetadataSetNode._instance;
    }

    override async handleRun(prevResult, options: NodeDef<Args, 'metadata_set'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('MetadataSetNode', options);
        switch (options.primitive_name) {
            case 'metadata_set':
                scenario.metadata.extra_metadata[args.key] = args.value;
                scenario.saveMetadata();
                break;
        }
        return 0;
    }
}
